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

set -u

LOG_FILE="/var/log/huurgo-watchdog.log"
APP_DIR="/opt/huurgo"
APP_URL="http://localhost:3000"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
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
  else
    log "HATA: netplan apply sonrası hala varsayılan rota yok. Elle müdahale gerekli (TransIP konsolu)."
  fi
fi

# İnternete gerçekten çıkabiliyor muyuz? (rota var görünüp de trafik
# geçmeyebilir — kısa bir bağlantı testiyle doğrula.)
if ! ping -c 1 -W 3 8.8.8.8 > /dev/null 2>&1; then
  log "UYARI: internet erişimi yok (ping 8.8.8.8 başarısız). Ağ tarafı hala sorunlu olabilir."
fi

# --- 2. Docker servisi ayakta mı? ---
if ! systemctl is-active --quiet docker; then
  log "UYARI: docker servisi çalışmıyor. Başlatılıyor..."
  systemctl start docker >> "$LOG_FILE" 2>&1
  sleep 5
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
  else
    log "HATA: app konteynerini yeniden başlattıktan sonra hala yanıt yok. Elle bakılmalı: docker compose logs app"
  fi
else
  log "OK: ağ ve uygulama sağlıklı."
fi
