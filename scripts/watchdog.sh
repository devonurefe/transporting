#!/bin/bash
# HuurGo VPS İzleme (Watchdog) Scripti — TransIP Ubuntu
#
# Amaç: 26 Temmuz'daki kesintide görülen senaryoyu (ens3 ağ arayüzü DHCP
# rotasını kaybediyor, sunucu içeriden sağlıklı ama dışarıdan erişilemez hale
# geliyor) elle müdahale beklemeden kendi kendine düzeltmek. Ayrıca uygulama
# konteyneri ayakta ama yanıt vermiyor durumuna ve disk doluluğuna karşı ek
# güvenlik ağları.
#
# Kurulum (VPS'te bir kere, root olarak):
#   chmod +x /opt/huurgo/scripts/watchdog.sh
#   crontab -e
#   Şu satırı ekle:
#   */5 * * * * /opt/huurgo/scripts/watchdog.sh
#
# Her çalıştırmada tek satırlık bir durum kaydı düşer; sorun bulup düzeltirse
# ayrıca ne yaptığını da yazar. Geçmişi görmek için: tail -50 /var/log/huurgo-watchdog.log
#
# Bildirim: bir sorun tespit edildiğinde (düzelse de düzelmese de) ALERT_EMAIL
# adresine e-posta gönderir (bkz. notify.sh — uygulamanın zaten kullandığı
# Resend hesabını yeniden kullanır, VPS'e ayrı bir mail sunucusu gerekmez).
# Aynı sorun art arda tetiklenirse spam olmasın diye 30 dakikada bir kereden
# fazla e-posta atılmaz (anahtar bazlı, sorun tipleri birbirinden bağımsız).

set -u

LOG_FILE="/var/log/huurgo-watchdog.log"
STATE_FILE="/var/log/huurgo-watchdog.notified"
APP_DIR="/opt/huurgo"
APP_URL="http://localhost:3000"
DISK_WARN_PERCENT=85
NOTIFY_COOLDOWN_SECONDS=1800

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./notify.sh
source "$SCRIPT_DIR/notify.sh"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# notify <anahtar> <konu> <govde>
# <anahtar>: aynı sorun tipi için tekrar bildirim göndermeden önce bekleme
# süresini takip eden basit bir dosya adı (ör. "network", "app", "disk").
notify() {
  local key="$1" subject="$2" body="$3"
  local now last_ts=0

  now=$(date +%s)
  if [ -f "$STATE_FILE" ]; then
    last_ts=$(grep "^${key}:" "$STATE_FILE" 2>/dev/null | cut -d: -f2)
    [ -z "$last_ts" ] && last_ts=0
  fi
  if [ $((now - last_ts)) -lt "$NOTIFY_COOLDOWN_SECONDS" ]; then
    return
  fi

  send_alert "$subject" "$body" >> "$LOG_FILE" 2>&1

  # Bu anahtar için son bildirim zamanını güncelle (dosyayı satır satır yeniden yaz).
  { [ -f "$STATE_FILE" ] && grep -v "^${key}:" "$STATE_FILE"; echo "${key}:${now}"; } > "${STATE_FILE}.tmp" 2>/dev/null
  mv "${STATE_FILE}.tmp" "$STATE_FILE"
}

PROBLEM_FOUND=0

# --- 1. Ağ kontrolü: varsayılan rota var mı? ---
# "ip route show" boş dönerse (default satırı yoksa) sunucu dışarıyla
# konuşamıyor demektir — tam olarak 26 Temmuz'daki DHCP rota kaybı.
if ! ip route show | grep -q '^default'; then
  PROBLEM_FOUND=1
  log "UYARI: varsayılan ağ rotası yok. 'netplan apply' deneniyor..."
  netplan apply >> "$LOG_FILE" 2>&1
  sleep 5
  if ip route show | grep -q '^default'; then
    log "DUZELDI: netplan apply sonrası varsayılan rota geri geldi."
    notify "network" "huurgo.nl: agi kaybetti, otomatik duzeltildi" "Sunucunun varsayilan ag rotasi kayboldu, netplan apply ile otomatik geri geldi. Elle bir sey yapmaniza gerek yok, bilgi amaclidir."
  else
    log "HATA: netplan apply sonrası hala varsayılan rota yok. Elle müdahale gerekli (TransIP konsolu)."
    notify "network" "ACIL: huurgo.nl agi kopuk, otomatik duzelmedi" "Sunucunun varsayilan ag rotasi kayip ve netplan apply cozemedi. Lutfen TransIP konsolundan elle bakin."
  fi
fi

# İnternete gerçekten çıkabiliyor muyuz? (rota var görünüp de trafik
# geçmeyebilir — kısa bir bağlantı testiyle doğrula.)
if ! ping -c 1 -W 3 8.8.8.8 > /dev/null 2>&1; then
  PROBLEM_FOUND=1
  log "UYARI: internet erişimi yok (ping 8.8.8.8 başarısız). Ağ tarafı hala sorunlu olabilir."
  notify "internet" "huurgo.nl: internet erisimi yok" "Sunucu rotasi var gorunuyor ama disariya ping atamiyor. Ag tarafinda hala bir sorun olabilir, TransIP konsolundan bakin."
fi

# --- 2. Docker servisi ayakta mı? ---
if ! systemctl is-active --quiet docker; then
  PROBLEM_FOUND=1
  log "UYARI: docker servisi çalışmıyor. Başlatılıyor..."
  systemctl start docker >> "$LOG_FILE" 2>&1
  sleep 5
  if systemctl is-active --quiet docker; then
    notify "docker" "huurgo.nl: docker durmustu, otomatik baslatildi" "Docker servisi calismiyordu, watchdog basariyla yeniden baslatti."
  else
    notify "docker" "ACIL: huurgo.nl docker baslatilamadi" "Docker servisi calismiyor ve watchdog baslatamadi. Elle bakilmasi gerekiyor."
  fi
fi

# --- 3. Uygulama gerçekten yanıt veriyor mu? ---
# Konteyner "Up" görünse bile uygulama içeride takılı kalmış olabilir —
# gerçek bir HTTP isteğiyle doğrula, sadece "docker ps" ile yetinme.
if ! curl -sf -m 5 -o /dev/null "$APP_URL"; then
  PROBLEM_FOUND=1
  log "UYARI: uygulama $APP_URL adresinden yanıt vermiyor. Sadece 'app' konteyneri yeniden başlatılıyor..."
  cd "$APP_DIR" && docker compose up -d --force-recreate --no-deps app >> "$LOG_FILE" 2>&1

  # docker-compose.yml'deki app healthcheck'i start_period: 40s tanımlıyor —
  # yani container'ın kendisi bile ilk 40 saniye boyunca "henüz hazırlanıyor"
  # kabul ediyor. Tek seferlik bir "sleep 10" + tek curl, tam da bu normal
  # açılış penceresinde yanlış "ACIL" e-postası atıyordu: elle yapılan bir
  # `docker compose up -d --force-recreate` sırasında (mesela Mollie anahtarı
  # gibi bir env değişikliği için) cron aynı ana denk gelirse, watchdog kendi
  # restart'ını da üstüne bindiriyor, 10 saniye sonra uygulama Express/Prisma
  # başlatmayı bitirmemiş oluyor ve gerçekte birkaç saniye içinde düzelecek bir
  # durum "hala yanit yok" olarak bildiriliyordu. Healthcheck'in kendi
  # toleransıyla eşleşen bir yeniden-deneme penceresi (45s, 5s aralıklarla)
  # kullanıyoruz artık.
  RECOVERED=0
  for _ in $(seq 1 9); do
    sleep 5
    if curl -sf -m 5 -o /dev/null "$APP_URL"; then
      RECOVERED=1
      break
    fi
  done

  if [ "$RECOVERED" = "1" ]; then
    log "DUZELDI: app konteyneri yeniden başlatıldı, artık yanıt veriyor."
    notify "app" "huurgo.nl: uygulama yaniti kesildi, otomatik duzeltildi" "Uygulama konteyneri yanit vermiyordu, watchdog yeniden baslatti ve duzeldi."
  else
    log "HATA: app konteynerini yeniden başlattıktan sonra hala yanıt yok (45s bekleyerek denendi). Elle bakılmalı: docker compose logs app"
    notify "app" "ACIL: huurgo.nl uygulama yaniti yok" "Uygulama konteyneri yeniden baslatildi ama 45 saniye boyunca hala yanit vermedi. Elle bakin: docker compose logs app"
  fi
fi

# --- 4. Disk doluluğu ---
# Otomatik düzeltme yok (silinecek "güvenli" bir şey watchdog'un bilebileceği
# bir konu değil) — sadece eşiği geçince erken uyarı, disk tamamen dolup
# Postgres/Docker/yedekleme aynı anda bozulmadan önce.
disk_percent=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')
if [ -n "$disk_percent" ] && [ "$disk_percent" -ge "$DISK_WARN_PERCENT" ]; then
  PROBLEM_FOUND=1
  log "UYARI: disk kullanimi %${disk_percent} (esik: %${DISK_WARN_PERCENT})."
  notify "disk" "UYARI: huurgo.nl disk doluluğu %${disk_percent}" "Sunucu diski %${disk_percent} dolu. 'docker system prune -af' ile eski imajlari temizlemeyi (ASLA --volumes eklemeyin, veritabani siliniyor) veya TransIP'ten disk buyutmeyi dusunun."
fi

if [ "$PROBLEM_FOUND" -eq 0 ]; then
  log "OK: ağ, uygulama ve disk sağlıklı."
fi
