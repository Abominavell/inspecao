#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Node $(node -v) / npm $(npm -v)"

if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  echo ""
  echo "Edite frontend/.env.production (NEXT_PUBLIC_API_URL) e rode este script de novo."
  exit 0
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

echo "==> API: $NEXT_PUBLIC_API_URL"

npm ci
npm run build

chmod +x start.sh
echo ""
echo "Setup OK. No CloudPanel:"
echo "  App Port: 3000"
echo "  Start: $(pwd)/start.sh"
