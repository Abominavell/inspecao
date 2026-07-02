# Deploy do frontend no CloudPanel

Interface: **https://inspecaoiadvh.org.br** (ajuste o domínio)  
API: **https://apiinspecaoiadvh.org.br**  
Porta Node: **3000**

## 1. Criar site no CloudPanel

| Campo | Valor |
|-------|--------|
| Tipo | **Node.js Site** |
| Domain | `inspecaoiadvh.org.br` (ou o domínio do frontend) |
| Node.js | 22 |
| App Port | `3000` |

## 2. Código no servidor

```bash
SITE_ROOT="/home/SEU_USUARIO/htdocs/inspecaoiadvh.org.br"
# exemplo espelhando o backend:
# /home/inspecaoiadvh/htdocs/inspecaoiadvh.org.br

cd "$SITE_ROOT"
git clone https://github.com/Abominavell/inspecao.git repo
ln -sfn repo/frontend frontend
cd frontend
bash setup-cloudpanel.sh
nano .env.production
```

`.env.production`:

```env
NEXT_PUBLIC_API_URL=https://apiinspecaoiadvh.org.br
```

Importante: `NEXT_PUBLIC_API_URL` é lida no **build**. Se mudar a URL da API, rode `npm run build` de novo.

```bash
bash setup-cloudpanel.sh
```

## 3. Start command no CloudPanel

```
/caminho/completo/frontend/start.sh
```

Working directory: pasta `frontend/`

## 4. CORS na API

No `.env` do **backend**, inclua a URL do frontend:

```env
CORS_ORIGINS=https://inspecaoiadvh.org.br,https://www.inspecaoiadvh.org.br
```

Reinicie o backend (CloudPanel Restart).

## 5. DNS + SSL

Mesmo processo da API:

- Registro **A** do domínio do frontend → `76.13.237.31`
- Let's Encrypt no CloudPanel (após DNS propagar)

## 6. Verificar

```bash
curl -I https://inspecaoiadvh.org.br
```

No navegador: tela de login da plataforma.

Login padrão: `admin@ssma.com.br` + senha definida no backend.

## Atualizar

```bash
cd .../repo && git pull
cd ../frontend
source .env.production  # ou export NEXT_PUBLIC_API_URL=...
npm ci
npm run build
# Restart no CloudPanel
```
