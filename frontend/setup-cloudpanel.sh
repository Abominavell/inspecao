#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Node $(node -v) / npm $(npm -v)"

if [ ! -f .env.production ]; then
  if [ -f env.production.example ]; then
    cp env.production.example .env.production
  else
    cp .env.production.example .env.production
  fi
  echo ""
  echo "Edite frontend/.env.production e rode este script de novo."
  exit 0
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

echo "==> API: $NEXT_PUBLIC_API_URL"
echo "==> Porta: ${PORT:-3011}"

npm ci
npm run build

if [ -d .next/standalone ]; then
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public
fi

chmod +x start.sh
echo ""
echo "Setup OK."
echo "PM2 (produção): bash $(pwd)/../repo/deploy/cloudpanel/pm2-start.sh"
echo "CloudPanel — App Port: ${PORT:-3011}"
echo "CloudPanel — Start: $(pwd)/start.sh  (delega ao PM2)"
