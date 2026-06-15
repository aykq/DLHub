#!/bin/bash
# Cloudflare Tunnel kurulum scripti
# Önce: https://dash.cloudflare.com/ > Zero Trust > Networks > Tunnels > Create tunnel
# Tunnel oluşturduktan sonra size bir token verecek. Aşağıdaki komutu çalıştırın:
#
#   TUNNEL_TOKEN=<token> bash setup-cloudflare-tunnel.sh
#
set -e

if [ -z "$TUNNEL_TOKEN" ]; then
  echo "Hata: TUNNEL_TOKEN ortam değişkeni ayarlanmamış."
  echo "Kullanım: TUNNEL_TOKEN=<token> bash setup-cloudflare-tunnel.sh"
  exit 1
fi

echo "==> cloudflared kurulum"
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | tee /etc/apt/sources.list.d/cloudflared.list
apt-get update -y && apt-get install -y cloudflared

echo "==> Systemd servisi oluştur"
cloudflared service install "$TUNNEL_TOKEN"
systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared

echo ""
echo "==> Tunnel aktif. Cloudflare dashboard'da routing'i kontrol et:"
echo "    dlhub.aykq.org.tr -> http://localhost:3001"
