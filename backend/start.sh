#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PM2_APP="api-inspecao"
CONFIG="$(readlink -f "$(dirname "$0")")/../repo/deploy/cloudpanel/ecosystem.config.cjs"

# CloudPanel chama este script no Restart — delegar ao PM2 (único gerenciador)
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    pm2 reload "$PM2_APP" --update-env
    exit 0
  fi
  if [ -f "$CONFIG" ]; then
    pm2 start "$CONFIG" --only "$PM2_APP"
    pm2 save
    exit 0
  fi
fi

if [ ! -d .venv ]; then
  echo "Ambiente virtual não encontrado. Execute: bash setup-cloudpanel.sh"
  exit 1
fi

source .venv/bin/activate
exec gunicorn -c gunicorn.conf.py
