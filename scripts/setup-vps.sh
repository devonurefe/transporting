#!/bin/bash
# HuurGo VPS Kurulum Scripti — TransIP Ubuntu VPS
# Kullanım: sudo bash setup-vps.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "================================================"
echo "  HuurGo VPS Kurulum — huurgo.nl"
echo "================================================"
echo ""

# Root kontrolü
[ "$EUID" -ne 0 ] && error "Lütfen sudo ile çalıştır: sudo bash setup-vps.sh"

# ─── 1. SİSTEM GÜNCELLEMESİ ───────────────────────
info "Sistem güncelleniyor..."
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q git curl wget ufw fail2ban

# ─── 2. DOCKER ────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Docker yükleniyor..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  info "Docker zaten yüklü: $(docker --version)"
fi

# Docker Compose plugin kontrolü
if ! docker compose version &>/dev/null; then
  info "Docker Compose yükleniyor..."
  apt-get install -y docker-compose-plugin
fi
info "Docker Compose: $(docker compose version)"

# ─── 3. PROJE CLONE / GÜNCELLEME ──────────────────
APP_DIR="/opt/huurgo"
if [ -d "$APP_DIR/.git" ]; then
  info "Repo güncelleniyor..."
  cd "$APP_DIR" && git pull origin main
else
  info "Repo klonlanıyor..."
  git clone https://github.com/devonurefe/transporting.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ─── 4. .ENV DOSYASI ──────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  warn ".env dosyası zaten var, atlanıyor. Değiştirmek için: nano $ENV_FILE"
else
  info ".env dosyası oluşturuluyor..."

  # Rastgele şifreler üret
  POSTGRES_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
  REMINDER_SECRET=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  CALENDAR_TOKEN=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

  cat > "$ENV_FILE" <<EOF
# ── Database ─────────────────────────────────────
POSTGRES_PASSWORD=${POSTGRES_PASS}
DATABASE_URL=postgresql://huurgo:${POSTGRES_PASS}@postgres:5432/huurgo?connection_limit=10&pool_timeout=20

# ── Authenticatie ─────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── App ───────────────────────────────────────────
NODE_ENV=production
PORT=3000
APP_URL=https://huurgo.nl

# ── WhatsApp ──────────────────────────────────────
VITE_WHATSAPP_NUMBER=31611848899

# ── E-mail (Resend) ───────────────────────────────
# Resend API key: https://resend.com/api-keys
RESEND_API_KEY=
EMAIL_FROM=noreply@huurgo.nl
ADMIN_EMAIL=info@mbhoogwerkers.com

# ── Cron / Kalender ───────────────────────────────
REMINDER_SECRET=${REMINDER_SECRET}
CALENDAR_FEED_TOKEN=${CALENDAR_TOKEN}

# ── Analytics (optioneel) ─────────────────────────
VITE_CLARITY_ID=
EOF

  info ".env oluşturuldu"
  warn "RESEND_API_KEY'i eklemek için: nano $ENV_FILE"
fi

# ─── 5. CERTBOT (SSL) DİZİNLERİ ──────────────────
mkdir -p "$APP_DIR/certbot/conf" "$APP_DIR/certbot/www"
info "Certbot dizinleri hazır"

# ─── 6. FIREWALL ──────────────────────────────────
info "Firewall yapılandırılıyor..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
info "Firewall aktif (22, 80, 443)"

# ─── 7. FAIL2BAN ──────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban
info "Fail2ban aktif (brute-force koruması)"

# ─── 8. SSH KEY OLUŞTUR ───────────────────────────
SSH_KEY_DIR="/root/.ssh/huurgo_deploy"
if [ ! -f "${SSH_KEY_DIR}" ]; then
  info "Deploy SSH key oluşturuluyor..."
  ssh-keygen -t ed25519 -f "$SSH_KEY_DIR" -N "" -C "huurgo-deploy-$(date +%Y%m%d)"
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  PRIVATE KEY — Kopyala ve güvenli sakla!"
  echo "════════════════════════════════════════════════"
  cat "${SSH_KEY_DIR}"
  echo "════════════════════════════════════════════════"
  echo ""
  # Public key'i authorized_keys'e ekle
  cat "${SSH_KEY_DIR}.pub" >> /root/.ssh/authorized_keys
  info "Public key authorized_keys'e eklendi"
fi

# ─── 9. AUTO-DEPLOY WEBHOOK ───────────────────────
WEBHOOK_SCRIPT="/opt/huurgo-deploy.sh"
cat > "$WEBHOOK_SCRIPT" <<'DEPLOY'
#!/bin/bash
cd /opt/huurgo
git pull origin main 2>&1
docker compose up -d --build 2>&1
echo "[$(date)] Deploy tamamlandı" >> /var/log/huurgo-deploy.log
DEPLOY
chmod +x "$WEBHOOK_SCRIPT"
info "Deploy scripti hazır: $WEBHOOK_SCRIPT"

# ─── 10. DOCKER COMPOSE BAŞLAT ────────────────────
info "Docker servisleri başlatılıyor..."
cd "$APP_DIR"

# Önce http-only başlat (SSL sertifikası için)
# nginx.conf SSL satırlarını geçici olarak yorum satırına al
docker compose up -d postgres
info "PostgreSQL başlatıldı, 10 saniye bekleniyor..."
sleep 10

# App'i başlat
docker compose up -d app
info "Uygulama başlatıldı"

# ─── 11. ÖZET ─────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  KURULUM TAMAMLANDI"
echo "════════════════════════════════════════════════"
echo ""
info "Sonraki adımlar:"
echo ""
echo "  1. DNS güncelle (TransIP paneli):"
echo "     A record @ → 85.10.148.108"
echo "     (mevcut değer 37.97.254.27'yi değiştir)"
echo ""
echo "  2. Resend API key ekle:"
echo "     nano /opt/huurgo/.env"
echo ""
echo "  3. SSL sertifikası al (DNS aktif olduktan sonra):"
echo "     bash /opt/huurgo/scripts/setup-ssl.sh"
echo ""
echo "  4. Tam başlat:"
echo "     cd /opt/huurgo && docker compose up -d"
echo ""
docker compose ps
echo ""
