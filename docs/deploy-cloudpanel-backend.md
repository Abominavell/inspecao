# Deploy do backend no CloudPanel

API: **https://apiinspecaoiadvh.org.br**  
Porta da aplicação: **8000**

## Checklist completo (o que costuma faltar)

| # | Onde | O que fazer | Como saber se está OK |
|---|------|-------------|------------------------|
| 1 | **Registrador DNS** | Registro **A** `apiinspecaoiadvh` → IP do VPS | `nslookup apiinspecaoiadvh.org.br` retorna o IP |
| 2 | **CloudPanel** | Site Python criado com domínio `apiinspecaoiadvh.org.br` | Site aparece no painel |
| 3 | **CloudPanel** | App Port **8000** + start `backend/start.sh` | App reinicia sem erro |
| 4 | **CloudPanel** | SSL Let's Encrypt (só após DNS propagar) | Cadeado no navegador |
| 5 | **Servidor** | Código, venv, `migrate`, `.env` com MySQL | `curl http://127.0.0.1:8000/health` → `{"status":"ok"}` |
| 6 | **Servidor** | `migrate` (checklist embutido importa sozinho) | `/checklist` retorna dados |
| 7 | **.env** | `ALLOWED_HOSTS=apiinspecaoiadvh.org.br` | Sem erro 400 DisallowedHost |

**Erro `DNS_PROBE_FINISHED_NXDOMAIN`** = passo **1** ainda não feito (domínio não resolve na internet). O Gunicorn pode estar perfeito e o site ainda não abrir no navegador.

---

## 0. DNS (obrigatório antes do SSL)

### Descobrir o IP do servidor

```bash
curl -4 ifconfig.me
```

### Criar registro no painel do domínio (`iadvh.org.br`)

No Registro.br, Cloudflare ou onde o domínio está:

| Tipo | Nome / Host | Valor | TTL |
|------|-------------|-------|-----|
| **A** | `apiinspecaoiadvh` | IP do servidor (ex. `45.x.x.x`) | 300–3600 |

Isso cria `apiinspecaoiadvh.org.br` → seu VPS.

**Registro.br:** DNS → zona `iadvh.org.br` → novo registro → tipo A → nome `apiinspecaoiadvh` → dados = IP.

Aguarde propagação (minutos a algumas horas). Teste:

```bash
nslookup apiinspecaoiadvh.org.br
ping apiinspecaoiadvh.org.br
```

Só depois disso: CloudPanel → site → **SSL** → Let's Encrypt.

---

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
cd /home/apiinspecaoiadvh/htdocs/apiinspecaoiadvh.org.br
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
/home/apiinspecaoiadvh/htdocs/apiinspecaoiadvh.org.br/backend/start.sh
```

Ou manualmente:

```
/home/apiinspecaoiadvh/htdocs/apiinspecaoiadvh.org.br/backend/.venv/bin/gunicorn -c gunicorn.conf.py
```

**Working directory:** pasta `backend/`

## 4. Nginx — fotos (`/media/`)

No CloudPanel: **Vhost → Custom Nginx Configuration**, cole o conteúdo de  
`deploy/cloudpanel/nginx-media.conf` (ajuste o `alias` se o caminho for diferente).

Alternativa rápida: no `.env`, defina `SERVE_MEDIA=true` (Django serve as fotos; menos performático).

## 5. Checklist (automático)

O checklist do **Anexo IV** (21 seções, 113 itens) está embutido em  
`backend/inspections/data/checklist_anexo_iv.json` e é importado automaticamente no primeiro `migrate`.

Para reimportar manualmente:

```bash
python manage.py seed_checklist
```

Para atualizar a partir de um Excel novo:

```bash
python manage.py seed_checklist "/caminho/Anexo IV.xlsx" --replace --activate
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
cd /home/apiinspecaoiadvh/htdocs/apiinspecaoiadvh.org.br/repo
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
