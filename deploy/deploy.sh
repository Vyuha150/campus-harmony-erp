#!/usr/bin/env bash
# Update the ERP on the VPS to the latest `main` and restart it.
# Run on the VPS:  bash /var/www/campus-harmony-erp/deploy/deploy.sh
# It touches only /var/www/campus-harmony-erp and the PM2 process `campus-harmony-erp`.
set -euo pipefail

APP_DIR=/var/www/campus-harmony-erp
PORT=8726
cd "$APP_DIR"

echo "→ Pulling latest code"
git pull --ff-only

echo "→ Backend dependencies"
cd backend
npm ci --include=dev --no-audit --no-fund
npx prisma generate
cd ..

echo "→ Building frontend (API on the same origin under /api)"
npm ci --include=dev --no-audit --no-fund
VITE_API_BASE_URL=/api npm run build

echo "→ Restarting backend"
if pm2 describe campus-harmony-erp >/dev/null 2>&1; then
  pm2 reload campus-harmony-erp --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "→ Health check"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/ready" >/dev/null; then
    echo "✓ Backend ready on port $PORT"
    exit 0
  fi
  sleep 2
done
echo "✗ Backend did not become ready; see: pm2 logs campus-harmony-erp --lines 50"
exit 1
