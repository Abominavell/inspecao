# Deploy em produção (VPS + Docker)

## Requisitos do servidor

- Ubuntu 22.04+ (ou Debian) com Docker Engine e plugin Compose
- Porta **80** liberada no firewall
- Mínimo 2 GB RAM recomendado (build do Next.js)

## Passo a passo

### 1. Instalar Docker (no servidor)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# faça logout/login para o grupo docker valer
```

### 2. Clonar e configurar

```bash
sudo mkdir -p /opt/inspecao
sudo chown $USER:$USER /opt/inspecao
git clone https://github.com/Abominavell/inspecao.git /opt/inspecao
cd /opt/inspecao/deploy
cp .env.production.example .env
nano .env
```

Ajuste no `.env`:

| Variável | Exemplo |
|----------|---------|
| `PUBLIC_URL` | `http://203.0.113.10` ou `https://inspecao.exemplo.com.br` |
| `ALLOWED_HOSTS` | mesmo host (sem `http://`) |
| `CORS_ORIGINS` | igual a `PUBLIC_URL` |
| `CSRF_TRUSTED_ORIGINS` | igual a `PUBLIC_URL` |
| `ADMIN_PASSWORD` | senha forte |

Com **HTTPS** (depois do Certbot), altere também:

```
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
BEHIND_PROXY=true
```

### 3. Subir a aplicação

```bash
cd /opt/inspecao/deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Ou use o script automatizado:

```bash
bash /opt/inspecao/deploy/bootstrap.sh
```

### 4. Importar checklist (primeira vez)

Copie o Excel do Anexo IV para o servidor e execute:

```bash
docker compose -f deploy/docker-compose.prod.yml exec backend \
  python manage.py seed_checklist /caminho/Anexo\ IV\ -\ Check\ List.xlsx
```

### 5. Verificar

```bash
curl http://localhost/health
```

Acesse no navegador: `PUBLIC_URL` (ex.: `http://IP_DO_SERVIDOR`).

Login inicial: e-mail e senha definidos em `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Atualizar versão

```bash
cd /opt/inspecao
git pull
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## HTTPS com Let's Encrypt (opcional)

1. Aponte o domínio para o IP do servidor.
2. Instale Certbot e configure proxy SSL no Nginx (porta 443).
3. Atualize `PUBLIC_URL` para `https://...` e reconstrua o frontend:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build frontend
```

## Logs e troubleshooting

```bash
docker compose -f deploy/docker-compose.prod.yml logs -f
docker compose -f deploy/docker-compose.prod.yml ps
```

Dados persistentes: volumes Docker `backend_data` (SQLite) e `backend_uploads` (fotos).
