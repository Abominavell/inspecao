#!/usr/bin/env bash
# Recarrega API e/ou frontend no PM2 após deploy (sem derrubar portas de outros apps)
set -eu

TARGET="${1:-all}"

reload_app() {
  local app="$1"
  if pm2 describe "$app" >/dev/null 2>&1; then
    pm2 reload "$app" --update-env
  else
    echo "App PM2 '$app' não encontrado. Rode: bash deploy/cloudpanel/pm2-start.sh"
    exit 1
  fi
}

case "$TARGET" in
  api|api-inspecao) reload_app "api-inspecao" ;;
  front|frontend|inspecao-front) reload_app "inspecao-front" ;;
  all)
    reload_app "api-inspecao"
    reload_app "inspecao-front"
    ;;
  *)
    echo "Uso: $0 [all|api|front]"
    exit 1
    ;;
esac

pm2 save
curl -sf http://127.0.0.1:8011/health && echo " API OK"
curl -sf -o /dev/null -w "Frontend HTTP %{http_code}\n" http://127.0.0.1:3011/
