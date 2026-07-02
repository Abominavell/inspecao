#!/usr/bin/env bash
# Registra API + frontend no PM2
set -eu

REPO_API="/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/repo"
REPO_WEB="/home/iadvh-inspecao/htdocs/inspecao.iadvh.org.br/repo"
CONFIG="$REPO_API/deploy/cloudpanel/ecosystem.config.cjs"

cd "$REPO_API" && git pull -q
cd "$REPO_WEB" && git pull -q

# parar processos manuais anteriores (libera portas 8011 e 3011)
fuser -k 8011/tcp 2>/dev/null || true
fuser -k 3011/tcp 2>/dev/null || true
pkill -f "iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend/.venv/bin/gunicorn" 2>/dev/null || true
pkill -f "iadvh-inspecao/htdocs/inspecao.iadvh.org.br/frontend/.next/standalone/server.js" 2>/dev/null || true
sleep 2

pm2 delete api-inspecao 2>/dev/null || true
pm2 delete inspecao-front 2>/dev/null || true

pm2 start "$CONFIG"
pm2 save

echo ""
pm2 list | grep -E "api-inspecao|inspecao-front|name"
echo ""
curl -sf http://127.0.0.1:8011/health && echo " API OK"
curl -sf -o /dev/null -w "Frontend HTTP %{http_code}\n" http://127.0.0.1:3011/
