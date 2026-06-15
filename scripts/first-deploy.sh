#!/bin/bash
# İlk deploy — .env doldurulduktan sonra çalıştırılır.
set -e
cd /opt/dlhub

echo "==> Build all images"
docker compose build app migrate

echo "==> Start DB + metube"
docker compose up -d db metube

echo "==> Wait for DB to be healthy..."
sleep 5

echo "==> Run migrations"
docker compose --profile migrate run --rm migrate

echo "==> Start app"
docker compose up -d app

echo "==> Status"
docker compose ps

echo ""
echo "App is running on http://localhost:3001"
echo "Now configure Cloudflare Tunnel to point to http://localhost:3001"
