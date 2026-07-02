#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Ambiente virtual não encontrado. Execute: bash setup-cloudpanel.sh"
  exit 1
fi

source .venv/bin/activate
exec gunicorn -c gunicorn.conf.py
