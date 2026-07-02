#!/usr/bin/env bash
# Deploy frontend — inspecao.iadvh.org.br (porta 3011)
set -euo pipefail

SITE_ROOT="/home/iadvh-inspecao/htdocs/inspecao.iadvh.org.br"
REPO="$SITE_ROOT/repo"
FRONTEND="$SITE_ROOT/frontend"

echo "==> Git pull"
cd "$REPO"
git pull origin main

echo "==> Build"
cd "$FRONTEND"
set -a
# shellcheck disable=SC1091
source .env.production
set +a
npm ci
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "==> PM2 reload"
bash "$REPO/deploy/cloudpanel/pm2-reload.sh" front
