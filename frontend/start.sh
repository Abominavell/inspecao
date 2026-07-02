#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

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
