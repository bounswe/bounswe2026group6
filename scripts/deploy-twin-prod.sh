#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/neph}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if ! swapon --show | grep -q '/swapfile'; then
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi

  sudo swapon /swapfile

  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd -e backend/.env -e web/.env.production -e web/.env.local

cd "$APP_DIR/backend"
npm ci --omit=dev --no-audit --no-fund
pm2 restart neph-backend --update-env || pm2 start src/server.js --name neph-backend

cd "$APP_DIR/web"
pm2 delete neph-web || true
npm ci --no-audit --no-fund
npm run build
pm2 start npm --name neph-web --cwd "$APP_DIR/web" -- start -- -p 3001

pm2 save

pm2 status
curl -fsS http://127.0.0.1:3000/health
curl -fsSI http://127.0.0.1:3001
curl -fsSI https://twin-neph.app
curl -fsS https://twin-neph.app/health

