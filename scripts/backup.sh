#!/bin/bash
# HuurGo Yedekleme Scripti — Postgres + uploads
# Cron ile her gece çalıştırılır (bkz. scripts/vps-setup.sh).
#
# Ne yapar:
#   1. Postgres'i gzip'li SQL dump olarak yedekler
#   2. uploads/ klasörünü tar.gz olarak yedekler
#   3. (opsiyonel) RCLONE_REMOTE ayarlıysa yedekleri offsite'a kopyalar
#   4. Eski günlük yedekleri siler, ayın 1'indeki yedeği "monthly/" altına
#      taşıyıp daha uzun süre saklar
#   5. (opsiyonel) BACKUP_HEARTBEAT_URL ayarlıysa healthchecks.io tarzı bir
#      dead-man's-switch'e başarı/başarısızlık sinyali gönderir
#
# Offsite hedef kurulumu (bir kereye mahsus, elle yapılır):
#   1. Ucuz bir S3-uyumlu depolama seç (örn. Backblaze B2 — aylık birkaç
#      euro'ya, bu ölçekteki bir site için fazlasıyla yeterli).
#   2. VPS'te: `curl https://rclone.org/install.sh | sudo bash`
#   3. `rclone config` ile depolama hesabını "b2" adıyla tanımla (interaktif sihirbaz).
#   4. .env dosyasına ekle: RCLONE_REMOTE="b2:huurgo-backups"
#   5. Bu script'i elle bir kez çalıştırıp dosyanın gerçekten bucket'ta
#      göründüğünü doğrula: `bash scripts/backup.sh`
#
# RCLONE_REMOTE ayarlanmadığı sürece yedekler SADECE bu VPS'in diskinde durur
# — VPS'in kendisi kaybolursa (disk arızası, silinen instance) bu yedekler de
# gider. Offsite adımı atlamak "yedeksiz" durumdan daha iyidir ama gerçek
# felaket kurtarma için RCLONE_REMOTE şart.

set -eo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
MONTHLY_RETENTION_DAYS=180
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
DAY_OF_MONTH=$(date +%d)

# .env dosyasındaki RCLONE_REMOTE / BACKUP_HEARTBEAT_URL / BACKUP_RETENTION_DAYS
# değerlerini yükle (varsa)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

mkdir -p "$BACKUP_DIR/monthly"

ping_heartbeat() {
  # $1: "" (başarı) veya "/fail"
  if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
    curl -fsS --retry 2 --max-time 10 "${BACKUP_HEARTBEAT_URL}${1}" >/dev/null 2>&1 || true
  fi
}

trap 'echo "Yedekleme BAŞARISIZ oldu — $(date)"; ping_heartbeat "/fail"' ERR

echo "[$(date)] Yedekleme başlıyor..."

# 1. Veritabanı yedeği
DB_DUMP="$BACKUP_DIR/db-${TIMESTAMP}.sql.gz"
docker compose exec -T postgres pg_dump -U huurgo huurgo | gzip > "$DB_DUMP"
echo "  Database yedeği: $DB_DUMP ($(du -h "$DB_DUMP" | cut -f1))"

# 2. Uploads yedeği (varsa)
if [ -d ./uploads ] && [ "$(ls -A ./uploads 2>/dev/null)" ]; then
  UPLOADS_DUMP="$BACKUP_DIR/uploads-${TIMESTAMP}.tar.gz"
  tar czf "$UPLOADS_DUMP" uploads/
  echo "  Uploads yedeği: $UPLOADS_DUMP ($(du -h "$UPLOADS_DUMP" | cut -f1))"
else
  UPLOADS_DUMP=""
  echo "  Uploads klasörü boş/yok, atlanıyor."
fi

# 3. Ayın ilk günüyse aylık arşive de bir kopya koy (uzun süre saklanır)
if [ "$DAY_OF_MONTH" = "01" ]; then
  cp "$DB_DUMP" "$BACKUP_DIR/monthly/"
  [ -n "$UPLOADS_DUMP" ] && cp "$UPLOADS_DUMP" "$BACKUP_DIR/monthly/"
  echo "  Aylık arşive kopyalandı (ayın 1'i)."
fi

# 4. Offsite kopyalama (opsiyonel)
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone &> /dev/null; then
    rclone copy "$DB_DUMP" "$RCLONE_REMOTE/" --quiet
    [ -n "$UPLOADS_DUMP" ] && rclone copy "$UPLOADS_DUMP" "$RCLONE_REMOTE/" --quiet
    if [ "$DAY_OF_MONTH" = "01" ]; then
      rclone copy "$BACKUP_DIR/monthly/" "$RCLONE_REMOTE/monthly/" --quiet
    fi
    echo "  Offsite'a kopyalandı: $RCLONE_REMOTE"
  else
    echo "  UYARI: RCLONE_REMOTE ayarlı ama 'rclone' kurulu değil — sadece lokal yedek alındı."
  fi
else
  echo "  UYARI: RCLONE_REMOTE ayarlanmamış — yedekler SADECE bu sunucuda duruyor, offsite kopya yok."
fi

# 5. Eski günlük yedekleri temizle (aylık arşive dokunma)
find "$BACKUP_DIR" -maxdepth 1 -name "db-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -maxdepth 1 -name "uploads-*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR/monthly" -mtime "+${MONTHLY_RETENTION_DAYS}" -delete

echo "[$(date)] Yedekleme tamamlandı."
ping_heartbeat ""
