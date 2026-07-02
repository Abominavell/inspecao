# Deploy do backend no CloudPanel

API: **https://apiinspecaoiadvh.org.br**  
Porta da aplicação: **8000**

## 1. Site Python no CloudPanel

| Campo | Valor |
|-------|--------|
| Domain | `apiinspecaoiadvh.org.br` |
| Python | 3.12 |
| App Port | `8000` |
| SSL | Let's Encrypt (ativar no painel) |

## 2. Enviar o código

No SSH do servidor (ajuste o caminho do site no CloudPanel):

```bash
cd /home/cloudpanel/htdocs/apiinspecaoiadvh.org.br
git clone https://github.com/Abominavell/inspecao.git repo
ln -sfn repo/backend backend
cd backend
bash setup-cloudpanel.sh
```

Edite a senha do admin:

```bash
nano .env
# ADMIN_PASSWORD=...
```

## 3. Comando de start no CloudPanel

Em **Site → Settings → App** (ou equivalente Python):

```
/home/cloudpanel/htdocs/apiinspecaoiadvh.org.br/backend/start.sh
```

Ou manualmente:

```
/home/cloudpanel/htdocs/apiinspecaoiadvh.org.br/backend/.venv/bin/gunicorn -c gunicorn.conf.py
```

**Working directory:** pasta `backend/`

## 4. Nginx — fotos (`/media/`)

No CloudPanel: **Vhost → Custom Nginx Configuration**, cole o conteúdo de  
`deploy/cloudpanel/nginx-media.conf` (ajuste o `alias` se o caminho for diferente).

Alternativa rápida: no `.env`, defina `SERVE_MEDIA=true` (Django serve as fotos; menos performático).

## 5. Checklist (primeira vez)

Copie o Excel do Anexo IV para o servidor e importe:

```bash
cd /home/cloudpanel/htdocs/apiinspecaoiadvh.org.br/backend
source .venv/bin/activate
python manage.py seed_checklist "/caminho/Anexo IV - Check List.xlsx"
```

## 6. Verificar

```bash
curl https://apiinspecaoiadvh.org.br/health
```

```bash
curl -X POST https://apiinspecaoiadvh.org.br/auth/login/json \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ssma.com.br","password":"SUA_SENHA"}'
```

## 7. Atualizar versão

```bash
cd /home/cloudpanel/htdocs/apiinspecaoiadvh.org.br/repo
git pull
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reinicie o app no CloudPanel
```

## Variáveis (.env)

Arquivo modelo: `backend/.env.production.example`

| Variável | Produção |
|----------|----------|
| `ALLOWED_HOSTS` | `apiinspecaoiadvh.org.br` |
| `CORS_ORIGINS` | URL(s) do frontend Next.js |
| `CSRF_TRUSTED_ORIGINS` | `https://apiinspecaoiadvh.org.br` |
| `BEHIND_PROXY` | `true` |

## Frontend

Quando criar o site Node, use:

```
NEXT_PUBLIC_API_URL=https://apiinspecaoiadvh.org.br
```

E inclua a URL do frontend em `CORS_ORIGINS` no `.env` da API.
