#!/bin/bash
# HuurGo SSL Sertifikası — Let's Encrypt / Certbot
# Kullanım: sudo bash /opt/huurgo/scripts/setup-ssl.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

DOMAIN="huurgo.nl"
EMAIL="info@mbhoogwerkers.com"
APP_DIR="/opt/huurgo"

[ "$EUID" -ne 0 ] && error "sudo ile çalıştır: sudo bash setup-ssl.sh"

# DNS kontrolü
RESOLVED=$(dig +short "$DOMAIN" 2>/dev/null || nslookup "$DOMAIN" 2>/dev/null | grep Address | tail -1 | awk '{print $2}')
VPS_IP="85.10.148.108"

if [ "$RESOLVED" != "$VPS_IP" ]; then
  warn "DNS henüz VPS'i göstermiyor!"
  warn "Mevcut: $RESOLVED — Beklenen: $VPS_IP"
  warn "TransIP panelinde A record'u güncelle ve DNS yayılmasını bekle (max 1 saat)"
  read -p "Yine de devam et? (y/N): " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
fi

# Certbot yükle
if ! command -v certbot &>/dev/null; then
  info "Certbot yükleniyor..."
  apt-get install -y certbot
fi

# HTTP üzerinden nginx'i geçici olarak başlat
info "Geçici HTTP nginx başlatılıyor..."
cd "$APP_DIR"

# Geçici nginx konfigürasyonu (sadece HTTP, ACME challenge için)
docker run --rm -d \
  --name certbot-nginx \
  -p 80:80 \
  -v "$APP_DIR/certbot/www:/var/www/certbot" \
  nginx:alpine \
  sh -c 'echo "server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 200 \"ok\"; } }" > /etc/nginx/conf.d/default.conf && nginx -g "daemon off;"' 2>/dev/null || true

sleep 3

# Sertifika al
info "SSL sertifikası alınıyor..."
certbot certonly \
  --webroot \
  --webroot-path "$APP_DIR/certbot/www" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

# Geçici nginx durdur
docker stop certbot-nginx 2>/dev/null || true

info "SSL sertifikası alındı!"

# Auto-renewal cron
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'cd /opt/huurgo && docker compose restart nginx'") | crontab -
info "SSL otomatik yenileme kuruldu (her gün 03:00)"

# Tam stack başlat
info "Tüm servisler başlatılıyor..."
cd "$APP_DIR"
docker compose up -d

echo ""
echo "════════════════════════════════════════════════"
echo "  SSL KURULUMU TAMAMLANDI"
echo "════════════════════════════════════════════════"
echo ""
echo "  https://huurgo.nl → Açılıyor olmalı!"
echo "  https://www.huurgo.nl → Yönlendirme"
echo ""
docker compose ps
