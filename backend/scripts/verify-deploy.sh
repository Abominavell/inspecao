#!/usr/bin/env bash
# Verifica deploy — rode só na pasta backend do projeto
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate

echo "==> Django check"
python manage.py check

echo "==> Checklist"
python manage.py shell -c "from inspections.models import ChecklistItem; print('Itens:', ChecklistItem.objects.count())"

echo "==> API local (porta 8011)"
curl -sf http://127.0.0.1:8011/health
echo ""

echo "==> Nginx + SSL (SNI)"
curl -sk --resolve apiinspecao.iadvh.org.br:443:127.0.0.1 https://apiinspecao.iadvh.org.br/health
echo ""

echo "Deploy OK no servidor."
