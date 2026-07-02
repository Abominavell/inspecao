#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PM2_APP="inspecao-front"
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

if [ ! -d node_modules ]; then
  echo "Execute primeiro: bash setup-cloudpanel.sh"
  exit 1
fi

export NODE_ENV=production

if [ -f .env.production ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

export PORT="${PORT:-3011}"
export HOSTNAME="${HOSTNAME:-127.0.0.1}"

if [ -f .next/standalone/server.js ]; then
  cd .next/standalone
  exec node server.js
fi

exec npm start -- -p "$PORT" -H "$HOSTNAME"
