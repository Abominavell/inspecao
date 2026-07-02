#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Execute primeiro: bash setup-cloudpanel.sh"
  exit 1
fi

export NODE_ENV=production
export PORT="${PORT:-3000}"

if [ -f .env.production ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

exec npm start -- -p "$PORT"
