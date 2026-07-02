# Deploy do frontend no CloudPanel

Interface: **https://inspecao.iadvh.org.br**  
API: **https://apiinspecao.iadvh.org.br**  
Porta Node: **3000**

## 1. Criar site no CloudPanel

| Campo | Valor |
|-------|--------|
| Tipo | **Node.js Site** |
| Domain | `inspecao.iadvh.org.br` |
| Node.js | 22 LTS |
| App Port | `3000` |
| Site User | `inspecaoiadvh` (ou nome sugerido pelo painel) |

## 2. Código no servidor

```bash
SITE_ROOT="/home/inspecaoiadvh/htdocs/inspecao.iadvh.org.br"

cd "$SITE_ROOT"
git clone https://github.com/Abominavell/inspecao.git repo
ln -sfn repo/frontend frontend
cd frontend
bash setup-cloudpanel.sh
nano .env.production
```

`.env.production`:

```env
NEXT_PUBLIC_API_URL=https://apiinspecao.iadvh.org.br
```

```bash
bash setup-cloudpanel.sh
chmod +x start.sh
```

## 3. Start command no CloudPanel

```
/home/inspecaoiadvh/htdocs/inspecao.iadvh.org.br/frontend/start.sh
```

*(Ajuste se o usuário do site for outro — veja o caminho em **File Manager**.)*

## 4. CORS na API (backend)

No `.env` do backend:

```env
CORS_ORIGINS=https://inspecao.iadvh.org.br,https://www.inspecao.iadvh.org.br
```

Reinicie o site Python da API.

## 5. DNS + SSL

Na zona **iadvh.org.br**:

| Tipo | Nome | Valor |
|------|------|--------|
| A | `inspecao` | `76.13.237.31` |

Depois: CloudPanel → **SSL/TLS** → Let's Encrypt.

## 6. Verificar

```bash
curl -I https://inspecao.iadvh.org.br
```

Login: `admin@ssma.com.br` + senha do backend.
