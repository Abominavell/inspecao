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
| 4 | **SSL** | Let's Encrypt (após DNS propagar) |
| 5 | **Frontend** | `NEXT_PUBLIC_API_URL=https://apiinspecao.iadvh.org.br` |

---

## 1. Site Python no CloudPanel

| Campo | Valor |
|-------|--------|
| Domain | `apiinspecao.iadvh.org.br` |
| Python | 3.12 |
| **App Port** | **8011** |
| Site User | `iadvh-apiinspecao` |

**Start command:**

```
/home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend/start.sh
```

**Working directory:** `.../backend/`

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
bash start.sh
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

## 4. Nginx — fotos `/media/`

CloudPanel → **Vhost** → Custom, cole `deploy/cloudpanel/nginx-media.conf`:

```
alias /home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend/uploads/;
```

Ou use `SERVE_MEDIA=true` no `.env`.

---

## 5. Verificar

```bash
curl https://apiinspecao.iadvh.org.br/health
```

```bash
bash backend/scripts/verify-deploy.sh
```

---

## 6. Atualizar versão

```bash
cd /home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/repo
git pull
cd ../backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Restart no CloudPanel
```

---

## Frontend

```env
NEXT_PUBLIC_API_URL=https://apiinspecao.iadvh.org.br
```

Site: `https://inspecao.iadvh.org.br` (porta 3000)
