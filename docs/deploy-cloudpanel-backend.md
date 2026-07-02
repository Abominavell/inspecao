# Deploy do backend no CloudPanel

API: **https://apiinspecao.iadvh.org.br**  
Porta da aplicação: **8011**  
Caminho no servidor: `/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br`

## Checklist completo

| # | Onde | O que fazer |
|---|------|-------------|
| 1 | **DNS** | Registro **A** `apiinspecao` → `76.13.237.31` |
| 2 | **CloudPanel** | Site Python `apiinspecao.iadvh.org.br`, App Port **8011** |
| 3 | **Servidor** | Código, venv, `.env`, `migrate` | `curl http://127.0.0.1:8011/health` |
| 4 | **PM2** | `bash deploy/cloudpanel/pm2-start.sh` (único gerenciador de processo) |
| 5 | **SSL** | Let's Encrypt (após DNS propagar) |
| 6 | **Frontend** | `NEXT_PUBLIC_API_URL=https://apiinspecao.iadvh.org.br` |

---

## 1. Site Python no CloudPanel

| Campo | Valor |
|-------|--------|
| Domain | `apiinspecao.iadvh.org.br` |
| Python | 3.12 |
| **App Port** | **8011** |
| Site User | `iadvh-apiinspecao` |

**Start command** (delega ao PM2 — não inicia processo duplicado):

```
/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend/start.sh
```

**Working directory:** `.../backend/`

> O processo real roda no PM2 (`api-inspecao`). O CloudPanel cuida só de nginx, SSL e proxy reverso. **Não use Restart no painel** para deploy — use `pm2-reload.sh`.

---

## 2. Código no servidor (SSH)

```bash
SITE_ROOT="/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br"

cd "$SITE_ROOT"
git clone https://github.com/Abominavell/inspecao.git repo
ln -sfn repo/backend backend
cd backend
bash setup-cloudpanel.sh
nano .env
```

### `.env` (principais linhas)

```env
ALLOWED_HOSTS=apiinspecao.iadvh.org.br,localhost,127.0.0.1
CORS_ORIGINS=https://inspecao.iadvh.org.br
CSRF_TRUSTED_ORIGINS=https://apiinspecao.iadvh.org.br
GUNICORN_BIND=127.0.0.1:8011
DATABASE_URL=mysql://inspecaodb:SENHA@127.0.0.1:3306/inspecaodb
SERVE_MEDIA=true
ADMIN_PASSWORD=SuaSenhaForte
```

```bash
source .venv/bin/activate
python manage.py migrate --noinput
python manage.py collectstatic --noinput
chmod +x start.sh
bash ../repo/deploy/cloudpanel/pm2-start.sh
```

Teste:

```bash
curl http://127.0.0.1:8011/health
```

---

## 3. DNS (zona iadvh.org.br)

| Tipo | Nome | Valor |
|------|------|--------|
| A | `apiinspecao` | `76.13.237.31` |

```bash
nslookup apiinspecao.iadvh.org.br 8.8.8.8
```

---

## 4. Nginx — estáticos e mídia

CloudPanel → **Vhost** → Custom, cole o conteúdo de:

- `deploy/cloudpanel/nginx-static.conf` — CSS/JS do Django admin (`/static/`)
- `deploy/cloudpanel/nginx-media.conf` — fotos de inspeção (`/media/`)

Ou use `SERVE_MEDIA=true` no `.env` para servir `/media/` via Django (menos eficiente).

---

## 5. PM2 (gerenciador de processos)

```bash
bash deploy/cloudpanel/pm2-start.sh    # primeira vez ou reconfigurar
bash deploy/cloudpanel/pm2-reload.sh api   # após deploy da API
```

| Processo | Porta |
|----------|-------|
| `api-inspecao` | 8011 |
| `inspecao-front` | 3011 |

```bash
pm2 list
pm2 logs api-inspecao
pm2 restart api-inspecao
```

---

## 6. Verificar

```bash
curl https://apiinspecao.iadvh.org.br/health
bash backend/scripts/verify-deploy.sh
```

---

## 7. Atualizar versão

```bash
bash deploy/cloudpanel/deploy-server.sh
```

---

## Frontend

```env
NEXT_PUBLIC_API_URL=https://apiinspecao.iadvh.org.br
```

Site: `https://inspecao.iadvh.org.br` (porta **3011**)
