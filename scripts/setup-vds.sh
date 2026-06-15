#!/bin/bash
# VDS ilk kurulum scripti — root@194.62.54.96
# Bir kez çalıştırılır.
set -e

REPO_URL="https://github.com/USERNAME/dlhub.git"   # <- GitHub repo URL'ini buraya yaz
APP_DIR="/opt/dlhub"

echo "==> Docker kurulum"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Repo klonlama"
mkdir -p "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

echo "==> .env dosyası oluştur"
cp .env.example .env
echo ""
echo "!!! .env dosyasını düzenle: nano $APP_DIR/.env"
echo "!!! Sonra bu komutu çalıştır: bash $APP_DIR/scripts/first-deploy.sh"
