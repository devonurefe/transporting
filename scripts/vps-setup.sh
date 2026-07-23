#!/bin/bash
# HuurGo VPS Kurulum Scripti — TransIP Ubuntu
# Çalıştır: bash scripts/vps-setup.sh
set -e

DOMAIN="huurgo.nl"
EMAIL="koris.onur@gmail.com"
APP_DIR="/opt/huurgo"

echo "=========================================="
echo " HuurGo VPS Kurulum Başlıyor"
echo "=========================================="

# 1. Docker yüklü değilse kur
if ! command -v docker &> /dev/null; then
  echo "[1/8] Docker kuruluyor..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/8] Docker zaten kurulu, geçiliyor."
fi

# 2. Git yüklü değilse kur
if ! command -v git &> /dev/null; then
  echo "[2/8] Git kuruluyor..."
  apt-get install -y git
else
  echo "[2/8] Git zaten kurulu."
fi

# 3. Repo klonla veya güncelle
echo "[3/8] Uygulama kodu hazırlanıyor..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone https://github.com/devonurefe/transporting.git "$APP_DIR"
  cd "$APP_DIR"
fi

# 4. .env dosyası
if [ ! -f "$APP_DIR/.env" ]; then
  echo "[4/8] .env dosyası oluşturuluyor..."
  JWT=$(openssl rand -hex 32)
  PGPASS=$(openssl rand -hex 16)
  cat > "$APP_DIR/.env" <<EOF
JWT_SECRET=$JWT
POSTGRES_PASSWORD=$PGPASS
DATABASE_URL=postgresql://huurgo:${PGPASS}@postgres:5432/huurgo?connection_limit=10&pool_timeout=20
NODE_ENV=production
APP_URL=https://$DOMAIN
EMAIL_FROM=noreply@$DOMAIN
ADMIN_EMAIL=$EMAIL
RESEND_API_KEY=
VITE_WHATSAPP_NUMBER=31611691692
CALENDAR_FEED_TOKEN=
VITE_CLARITY_ID=
EOF
  echo ""
  echo "  *** .env dosyası oluşturuldu ***"
  echo "  JWT_SECRET ve POSTGRES_PASSWORD otomatik üretildi."
  echo "  Gerekirse: nano $APP_DIR/.env"
  echo ""
else
  echo "[4/8] .env zaten mevcut, atlanıyor."
fi

# 5. HTTP-only nginx ile başlat (SSL sertifikası için)
echo "[5/8] Servisler HTTP modunda başlatılıyor (sertifika alınacak)..."
cd "$APP_DIR"
cp nginx.conf nginx.conf.bak
cp nginx-init.conf nginx.conf
mkdir -p certbot/conf certbot/www
docker compose up -d postgres app nginx

echo "  Uygulama ayağa kalkıyor, 15 saniye bekleniyor..."
sleep 15

# 6. Let's Encrypt sertifikası al
echo "[6/8] SSL sertifikası alınıyor ($DOMAIN)..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

# 7. Tam HTTPS nginx config ile yeniden başlat
echo "[7/8] HTTPS nginx config etkinleştiriliyor..."
cp nginx.conf.bak nginx.conf
docker compose up -d nginx

# 8. Günlük veritabanı/uploads yedekleme cron'u kur (idempotent)
echo "[8/8] Günlük yedekleme cron'u kuruluyor (her gece 03:00)..."
mkdir -p "$APP_DIR/backups"
chmod +x "$APP_DIR/scripts/backup.sh"
CRON_LINE="0 3 * * * cd $APP_DIR && ./scripts/backup.sh >> $APP_DIR/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "backup.sh" || true; echo "$CRON_LINE" ) | crontab -
echo "  Cron kuruldu. Kontrol için: crontab -l"
echo "  Offsite yedekleme (önerilir) için scripts/backup.sh içindeki talimatlara bak."

echo ""
echo "=========================================="
echo " Kurulum Tamamlandı!"
echo " Site: https://$DOMAIN"
echo "=========================================="
echo ""
echo " Yönetici paneli: https://$DOMAIN/admin"
echo " Admin şifresi: npx prisma db seed çalıştırıldığında gösterilir"
echo ""
echo " Loglar için: docker compose logs -f app"
echo " Durum için:  docker compose ps"
echo " Yedekleri elle tetiklemek için: bash scripts/backup.sh"
