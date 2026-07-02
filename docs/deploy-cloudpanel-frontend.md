# Deploy do frontend no CloudPanel

Interface: **https://inspecao.iadvh.org.br**  
API: **https://apiinspecao.iadvh.org.br**  
Porta Node: **3011**  
Caminho: `/home/iadvh-inspecao/htdocs/inspecao.iadvh.org.br`

## 1. CloudPanel — Node.js Site

| Campo | Valor |
|-------|--------|
| Domain | `inspecao.iadvh.org.br` |
| Node.js | 22 LTS |
| **App Port** | **3011** |
| Site User | `iadvh-inspecao` |

**Start command** (delega ao PM2 — não inicia processo duplicado):

```
/home/iadvh-inspecao/htdocs/inspecao.iadvh.org.br/frontend/start.sh
```

> O processo real roda no PM2 (`inspecao-front`). Use `deploy-frontend.sh` ou `pm2-reload.sh` para atualizar.

## 2. SSH — deploy

```bash
SITE_ROOT="/home/iadvh-inspecao/htdocs/inspecao.iadvh.org.br"
cd "$SITE_ROOT"
git clone https://github.com/Abominavell/inspecao.git repo
ln -sfn repo/frontend frontend
cd frontend

cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://apiinspecao.iadvh.org.br
PORT=3011
HOSTNAME=127.0.0.1
EOF

bash setup-cloudpanel.sh
chmod +x start.sh
bash ../repo/deploy/cloudpanel/pm2-start.sh
```

## 3. CORS na API

Backend `.env`:

```env
CORS_ORIGINS=https://inspecao.iadvh.org.br,https://www.inspecao.iadvh.org.br
```

```bash
bash deploy/cloudpanel/pm2-reload.sh api
```

## 4. DNS

| Tipo | Nome | Valor |
|------|------|--------|
| A | `inspecao` | `76.13.237.31` |

## 5. Verificar

```bash
curl -I http://127.0.0.1:3011
curl -I https://inspecao.iadvh.org.br
```

## 6. PM2

```bash
bash deploy/cloudpanel/pm2-start.sh       # primeira vez
bash deploy/cloudpanel/pm2-reload.sh front   # após build
bash deploy/cloudpanel/deploy-frontend.sh    # git pull + build + reload
```

```bash
pm2 list
pm2 logs inspecao-front
pm2 restart inspecao-front
```
