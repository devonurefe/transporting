#!/bin/bash
# HuurGo Veritabanı Yedekleme Scripti — TransIP Ubuntu
#
# Şu ana kadar sunucuda hiçbir otomatik yedek yoktu — disk arızası veya
# yanlışlık durumunda tüm siparişler/müşteriler/makineler kalıcı olarak
# gidebilirdi. Bu script her gece Postgres'i yedekler ve eski yedekleri temizler.
#
# Kurulum (VPS'te bir kere, root olarak):
#   chmod +x /opt/huurgo/scripts/backup-db.sh
#   crontab -e
#   Şu satırı ekle (her gece 03:00'te çalışır):
#   0 3 * * * /opt/huurgo/scripts/backup-db.sh
#
# Yedekler: /opt/huurgo/backups/huurgo_YYYY-MM-DD_HH-MM-SS.sql.gz
# Saklama: son 14 gün, daha eskiler otomatik silinir.
# Geri yükleme:
#   gunzip -c /opt/huurgo/backups/huurgo_2026-07-26_03-00-01.sql.gz | \
#     docker exec -i huurgo-db psql -U huurgo huurgo

set -u

BACKUP_DIR="/opt/huurgo/backups"
RETENTION_DAYS=14
LOG_FILE="/var/log/huurgo-backup.log"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
FILE="$BACKUP_DIR/huurgo_${TIMESTAMP}.sql.gz"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR"

if docker exec huurgo-db pg_dump -U huurgo huurgo | gzip > "$FILE"; then
  SIZE=$(du -h "$FILE" 2>/dev/null | cut -f1)
  log "OK: yedek alindi -> $FILE ($SIZE)"
else
  log "HATA: yedek alma basarisiz oldu! (docker exec huurgo-db pg_dump basarisiz)"
  rm -f "$FILE"
fi

# RETENTION_DAYS'ten eski yedekleri sil
find "$BACKUP_DIR" -name "huurgo_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
