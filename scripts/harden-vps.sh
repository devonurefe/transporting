#!/bin/bash
# HuurGo VPS Sertleştirme Scripti — TransIP Ubuntu
# Çalıştır (bir kere, root olarak): bash scripts/harden-vps.sh
#
# Yapar:
#  1. ufw güvenlik duvarı — sadece 22 (SSH), 80, 443 açık, gerisi kapalı
#  2. fail2ban — SSH'a art arda başarısız giriş deneyen IP'leri otomatik banlar
#     (deploy akışı root+şifre ile SSH bağlandığı için kaba kuvvet saldırılarına
#     açık bir yüzey; fail2ban bunu bariz şekilde azaltır)
#  3. unattended-upgrades — güvenlik yamalarını otomatik kurar (konsolda görülen
#     "System restart required" mesajı, hiç kimsenin bunu elle yapmadığını gösteriyordu)
#
# İdempotent: paket zaten kuruluysa atlar, tekrar çalıştırmak güvenlidir.
set -e

echo "=========================================="
echo " HuurGo VPS Sertleştirme Başlıyor"
echo "=========================================="

apt-get update -qq

# 1. UFW
if ! command -v ufw &> /dev/null; then
  echo "[1/3] ufw kuruluyor..."
  apt-get install -y ufw
else
  echo "[1/3] ufw zaten kurulu."
fi
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
echo "  ufw durumu:"
ufw status verbose

# 2. fail2ban
if ! command -v fail2ban-client &> /dev/null; then
  echo "[2/3] fail2ban kuruluyor..."
  apt-get install -y fail2ban
else
  echo "[2/3] fail2ban zaten kurulu."
fi
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
port = 22
maxretry = 5
findtime = 600
bantime = 3600
EOF
systemctl enable fail2ban
systemctl restart fail2ban
echo "  fail2ban durumu:"
sleep 2
fail2ban-client status sshd || true

# 3. unattended-upgrades
if ! dpkg -l | grep -q unattended-upgrades; then
  echo "[3/3] unattended-upgrades kuruluyor..."
  apt-get install -y unattended-upgrades
else
  echo "[3/3] unattended-upgrades zaten kurulu."
fi
dpkg-reconfigure -f noninteractive unattended-upgrades

echo ""
echo "=========================================="
echo " Sertleştirme Tamamlandı!"
echo "=========================================="
echo " Kontrol için:"
echo "   ufw status verbose"
echo "   fail2ban-client status sshd"
echo "   cat /etc/apt/apt.conf.d/20auto-upgrades"
echo "=========================================="
