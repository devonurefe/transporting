#!/bin/bash
# HuurGo Veritabanı Yedekleme Scripti — TransIP Ubuntu
#
# Her gece Postgres'i yedekler, eski yedekleri temizler VE bir kopyasını
# e-posta eki olarak dışarı (huurgomb@gmail.com) gönderir — sunucunun kendi
# diski tamamen kaybolursa (nadir ama olur), yedeklerin canlı veriyle birlikte
# gitmemesi için. Sunucu-içi yedekler tek başına bu riski kapatmıyordu.
#
# Kurulum (VPS'te bir kere, root olarak):
#   chmod +x /opt/huurgo/scripts/backup-db.sh
#   crontab -e
#   Şu satırı ekle (her gece 03:00'te çalışır):
#   0 3 * * * /opt/huurgo/scripts/backup-db.sh
#
# Yedekler: /opt/huurgo/backups/huurgo_YYYY-MM-DD_HH-MM-SS.sql.gz
# Saklama: sunucuda son 14 gün, daha eskiler otomatik silinir.
# E-posta: RESEND_API_KEY tanımlıysa ve dosya 20MB'tan küçükse gönderilir;
#   değilse sadece sunucudaki kopya kalır (bilgi olarak loglanır, hata değil).
# Geri yükleme:
#   gunzip -c /opt/huurgo/backups/huurgo_2026-07-26_03-00-01.sql.gz | \
#     docker exec -i huurgo-db psql -U huurgo huurgo

set -u

BACKUP_DIR="/opt/huurgo/backups"
RETENTION_DAYS=14
LOG_FILE="/var/log/huurgo-backup.log"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
FILE="$BACKUP_DIR/huurgo_${TIMESTAMP}.sql.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./notify.sh
source "$SCRIPT_DIR/notify.sh"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR"

if docker exec huurgo-db pg_dump -U huurgo huurgo | gzip > "$FILE"; then
  SIZE=$(du -h "$FILE" 2>/dev/null | cut -f1)
  log "OK: yedek alindi -> $FILE ($SIZE)"

  if send_alert_with_attachment \
    "HuurGo yedek: $(basename "$FILE")" \
    "Otomatik gece yedegi ektedir ($SIZE). Sunucudaki kopyasi: $FILE" \
    "$FILE" \
    >> "$LOG_FILE" 2>&1; then
    log "OK: yedek e-posta ile de gonderildi (off-site kopya)."
  else
    log "BILGI: yedek e-postayla gonderilemedi, sadece sunucuda duruyor (yukaridaki satira bakin)."
  fi
else
  log "HATA: yedek alma basarisiz oldu! (docker exec huurgo-db pg_dump basarisiz)"
  rm -f "$FILE"
  send_alert \
    "ACIL: huurgo.nl veritabani yedegi alinamadi" \
    "Bu geceki otomatik pg_dump basarisiz oldu. Sunucuya bakip elle deneyin: docker exec huurgo-db pg_dump -U huurgo huurgo | gzip > yedek.sql.gz" \
    >> "$LOG_FILE" 2>&1
fi

# RETENTION_DAYS'ten eski yedekleri sil
find "$BACKUP_DIR" -name "huurgo_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
