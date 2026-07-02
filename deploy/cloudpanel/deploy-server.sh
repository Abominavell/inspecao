#!/usr/bin/env bash
# Deploy backend — apiinspecao.iadvh.org.br (porta 8011)
set -euo pipefail

SITE_ROOT="/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br"
REPO="$SITE_ROOT/repo"
BACKEND="$SITE_ROOT/backend"

echo "==> Git pull"
cd "$REPO"
git pull origin main

echo "==> Dependências"
cd "$BACKEND"
source .venv/bin/activate
pip install -r requirements.txt -q

echo "==> Migrate"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Verificar"
chmod +x start.sh scripts/verify-deploy.sh 2>/dev/null || chmod +x start.sh
bash scripts/verify-deploy.sh 2>/dev/null || curl -sf http://127.0.0.1:8011/health

echo "==> PM2 reload"
bash "$REPO/deploy/cloudpanel/pm2-reload.sh" api

echo ""
echo "Deploy concluído (PM2: api-inspecao)."
