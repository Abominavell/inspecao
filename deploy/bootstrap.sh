#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/inspecao}"
REPO="${REPO:-https://github.com/Abominavell/inspecao.git}"
BRANCH="${BRANCH:-main}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin não encontrado."
  exit 1
fi

if [ -d "$APP_DIR/.git" ]; then
  echo "Atualizando $APP_DIR..."
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  echo "Clonando repositório em $APP_DIR..."
  sudo mkdir -p "$APP_DIR"
  sudo chown "$(whoami):$(whoami)" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

cd "$APP_DIR/deploy"

if [ ! -f .env ]; then
  cp .env.production.example .env
  SECRET=$(openssl rand -hex 32)
  if sed --version >/dev/null 2>&1; then
    sed -i "s/CHANGE_ME_SECRET/$SECRET/" .env
  else
    sed -i '' "s/CHANGE_ME_SECRET/$SECRET/" .env
  fi
  echo ""
  echo "Arquivo deploy/.env criado. Edite PUBLIC_URL, ALLOWED_HOSTS, CORS_ORIGINS e ADMIN_PASSWORD."
  echo "Depois execute novamente: bash deploy/bootstrap.sh"
  exit 0
fi

echo "Construindo e iniciando containers..."
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "Aguardando API..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1/health >/dev/null; then
    echo "Deploy OK — http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost)/"
    exit 0
  fi
  sleep 2
done

echo "Containers iniciados, mas /health ainda não respondeu. Verifique: docker compose -f deploy/docker-compose.prod.yml logs"
exit 1
