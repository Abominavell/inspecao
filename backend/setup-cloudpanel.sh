#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Instalando dependências do sistema (WeasyPrint)..."
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
fi

echo "==> Criando ambiente virtual Python..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Configurando .env..."
if [ ! -f .env ]; then
  cp .env.production.example .env
  SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  if sed --version >/dev/null 2>&1; then
    sed -i "s/CHANGE_ME_SECRET/$SECRET/" .env
  else
    sed -i '' "s/CHANGE_ME_SECRET/$SECRET/" .env
  fi
  echo ""
  echo "Arquivo .env criado. Edite ADMIN_PASSWORD antes de ir para produção."
fi

mkdir -p data uploads staticfiles

echo "==> Migrando banco e coletando estáticos..."
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo ""
echo "Setup concluído."
echo "PM2 (produção): bash $(dirname "$0")/../repo/deploy/cloudpanel/pm2-start.sh"
echo "CloudPanel — App Port: 8011"
echo "CloudPanel — Start command: $(pwd)/start.sh  (delega ao PM2)"
echo ""
echo "Teste local: source .venv/bin/activate && gunicorn -c gunicorn.conf.py"
echo "Health: curl http://127.0.0.1:8011/health"
