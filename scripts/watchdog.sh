#!/bin/bash
# HuurGo VPS İzleme (Watchdog) Scripti — TransIP Ubuntu
#
# Amaç: 26 Temmuz'daki kesintide görülen senaryoyu (ens3 ağ arayüzü DHCP
# rotasını kaybediyor, sunucu içeriden sağlıklı ama dışarıdan erişilemez hale
# geliyor) elle müdahale beklemeden kendi kendine düzeltmek. Ayrıca uygulama
# konteyneri ayakta ama yanıt vermiyor durumuna karşı ikinci bir güvenlik ağı.
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
# adresine e-posta gönderir — uygulamanın zaten kullandığı Resend API'sini
# (RESEND_API_KEY/EMAIL_FROM, /opt/huurgo/.env içinden okunur) kullanır, VPS'e
# ayrı bir mail sunucusu kurmaya gerek kalmaz. Aynı sorun art arda tetiklenirse
# spam olmasın diye 30 dakikada bir kereden fazla e-posta atılmaz.

set -u

LOG_FILE="/var/log/huurgo-watchdog.log"
STATE_FILE="/var/log/huurgo-watchdog.notified"
APP_DIR="/opt/huurgo"
APP_URL="http://localhost:3000"
ALERT_EMAIL="huurgomb@gmail.com"
NOTIFY_COOLDOWN_SECONDS=1800

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Uygulamanın zaten kullandığı Resend hesabını yeniden kullan — .env'de
# tanımlı değilse (ör. RESEND_API_KEY hiç girilmemişse) sessizce atla, sadece
# log dosyasına yazmaya devam et.
RESEND_API_KEY=""
EMAIL_FROM="onboarding@resend.dev"
if [ -f "$APP_DIR/.env" ]; then
  val=$(grep -E '^RESEND_API_KEY=' "$APP_DIR/.env" | head -1 | cut -d'=' -f2-)
  [ -n "$val" ] && RESEND_API_KEY="$val"
  val=$(grep -E '^EMAIL_FROM=' "$APP_DIR/.env" | head -1 | cut -d'=' -f2-)
  [ -n "$val" ] && EMAIL_FROM="$val"
fi

# notify <anahtar> <konu> <govde>
# <anahtar>: aynı sorun tipi için tekrar bildirim göndermeden önce bekleme
# süresini takip eden basit bir dosya adı (ör. "network", "app").
notify() {
  local key="$1" subject="$2" body="$3"
  local now last_ts=0

  if [ -z "$RESEND_API_KEY" ]; then
    log "BILGI: RESEND_API_KEY tanimli degil, '$subject' icin e-posta gonderilemedi."
    return
  fi

  now=$(date +%s)
  if [ -f "$STATE_FILE" ]; then
    last_ts=$(grep "^${key}:" "$STATE_FILE" 2>/dev/null | cut -d: -f2)
    [ -z "$last_ts" ] && last_ts=0
  fi
  if [ $((now - last_ts)) -lt "$NOTIFY_COOLDOWN_SECONDS" ]; then
    return
  fi

  curl -s -m 10 -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer ${RESEND_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"${EMAIL_FROM}\",\"to\":[\"${ALERT_EMAIL}\"],\"subject\":\"${subject}\",\"text\":\"${body}\"}" \
    >> "$LOG_FILE" 2>&1

  # Bu anahtar için son bildirim zamanını güncelle (dosyayı satır satır yeniden yaz).
  { [ -f "$STATE_FILE" ] && grep -v "^${key}:" "$STATE_FILE"; echo "${key}:${now}"; } > "${STATE_FILE}.tmp" 2>/dev/null
  mv "${STATE_FILE}.tmp" "$STATE_FILE"
}

# --- 1. Ağ kontrolü: varsayılan rota var mı? ---
# "ip route show" boş dönerse (default satırı yoksa) sunucu dışarıyla
# konuşamıyor demektir — tam olarak 26 Temmuz'daki DHCP rota kaybı.
if ! ip route show | grep -q '^default'; then
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
  log "UYARI: internet erişimi yok (ping 8.8.8.8 başarısız). Ağ tarafı hala sorunlu olabilir."
  notify "internet" "huurgo.nl: internet erisimi yok" "Sunucu rotasi var gorunuyor ama disariya ping atamiyor. Ag tarafinda hala bir sorun olabilir, TransIP konsolundan bakin."
fi

# --- 2. Docker servisi ayakta mı? ---
if ! systemctl is-active --quiet docker; then
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
  log "UYARI: uygulama $APP_URL adresinden yanıt vermiyor. Sadece 'app' konteyneri yeniden başlatılıyor..."
  cd "$APP_DIR" && docker compose up -d --force-recreate --no-deps app >> "$LOG_FILE" 2>&1
  sleep 10
  if curl -sf -m 5 -o /dev/null "$APP_URL"; then
    log "DUZELDI: app konteyneri yeniden başlatıldı, artık yanıt veriyor."
    notify "app" "huurgo.nl: uygulama yaniti kesildi, otomatik duzeltildi" "Uygulama konteyneri yanit vermiyordu, watchdog yeniden baslatti ve duzeldi."
  else
    log "HATA: app konteynerini yeniden başlattıktan sonra hala yanıt yok. Elle bakılmalı: docker compose logs app"
    notify "app" "ACIL: huurgo.nl uygulama yaniti yok" "Uygulama konteyneri yeniden baslatildi ama hala yanit vermiyor. Elle bakin: docker compose logs app"
  fi
else
  log "OK: ağ ve uygulama sağlıklı."
fi
