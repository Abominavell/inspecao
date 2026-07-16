# Autenticação Dual — Microsoft Entra ID + Super Admin Master

## Visão geral

| Público | Entrada | Backend |
|---------|---------|---------|
| Colaboradores | `/login` → Microsoft (Auth.js) | `POST /auth/entra/exchange` → SimpleJWT |
| Super Admin | `/admin-master` | `POST /auth/master/login` → SimpleJWT |
| Campo offline | Login local no tablet | Sem Entra / sem Master web |

Domínios de produção:

- Frontend: `https://inspecao.iadvh.org.br`
- API: `https://apiinspecao.iadvh.org.br`

---

## 1) Arquivos alterados (principais)

### Backend
- `backend/accounts/models.py` — `auth_source`, `role`, `EntraIdentity`, `AuthAuditEvent`
- `backend/accounts/serializers.py`, `views.py`, `urls.py`, `signals.py`, `admin.py`, `managers.py`
- `backend/accounts/views_auth.py` — login legado, exchange, master
- `backend/accounts/tokens.py`, `permissions.py`
- `backend/accounts/services/entra.py`, `services/audit.py`
- `backend/accounts/migrations/0002_dual_auth.py`
- `backend/accounts/management/commands/ensure_master_admin.py`
- `backend/accounts/management/commands/deactivate_legacy_passwords.py`
- `backend/accounts/tests/test_auth_dual.py`
- `backend/config/settings.py` — flags Entra/Master + blacklist JWT
- `backend/requirements.txt` — PyJWT, cryptography
- `backend/.env.production.example`
- `deploy/cloudpanel/ensure-admin.sh` — usa `ensure_master_admin`

### Frontend
- `frontend/src/auth.ts`, `src/middleware.ts`
- `frontend/src/app/api/auth/[...nextauth]/route.ts`
- `frontend/src/app/login/page.tsx`, `login/layout.tsx`
- `frontend/src/app/admin-master/page.tsx`, `admin-master/painel/page.tsx`
- `frontend/src/components/AppShell.tsx`, `AuthSessionProvider.tsx`, `layout.tsx`
- `frontend/src/lib/api.ts`, `webAuth.ts`, `sync/SyncEngine.ts` (`clearAuthSession`)
- `frontend/scripts/build-mobile.mjs` — exclui Auth.js do export Capacitor
- `frontend/package.json` — `next-auth`
- `frontend/.env.example`, `env.production.example`
- `docs/auth-dual-entra-master.md` (este runbook)

---

## 2) Arquivos novos

Principais: `auth.ts`, `middleware.ts`, `views_auth.py`, `services/entra.py`, `services/audit.py`, `tokens.py`, `permissions.py`, `admin-master/*`, `ensure_master_admin`, `deactivate_legacy_passwords`, migration `0002_dual_auth`, este documento.

---

## 3) Explicação das alterações

1. **Refresh JWT** agora retorna `access_token` (compatível com o frontend).
2. **Logout web** limpa `localStorage` **e** IndexedDB `auth_session`; master chama blacklist; Entra chama `signOut`.
3. **Exchange Entra**: valida JWT Microsoft (JWKS, aud, iss, tid, oid), cria/atualiza usuário sem senha, emite SimpleJWT.
4. **Master**: endpoints próprios; só `INTERNAL_MASTER` + `SUPER_ADMIN`.
5. **Login `/login`**: com flag, botão Microsoft + link “Área Administrativa”.
6. **Capacitor**: build mobile remove temporariamente rotas Auth.js para não quebrar `output: export`.
7. **Segurança web**: cookies Auth.js `HttpOnly` + `SameSite=Lax` + `Secure` em produção; PKCE (`checks: pkce,state`); hint `ssma_auth_context` com `Secure` em HTTPS.

---

## 4) Configurar Microsoft Entra ID

1. Azure Portal → Microsoft Entra ID → App registrations → New registration.
2. Nome: `SSMA Inspeção` (exemplo).
3. Supported account types: Single tenant (recomendado).
4. Platform **Web** → Redirect URIs:
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - `https://inspecao.iadvh.org.br/api/auth/callback/microsoft-entra-id`
5. Certificates & secrets → New client secret.
6. Expose an API → Application ID URI (`api://<client-id>`) + scope (ex.: `access_as_user`).
7. API permissions: Microsoft Graph `openid`, `profile`, `email`, `User.Read` (se necessário) + o scope da própria API.
8. (Opcional) App roles: `ADMINISTRADOR`, `QUALIDADE`, `AUDITOR`, `GESTOR`, `COLABORADOR`.
9. Copie Tenant ID, Client ID e Secret para as variáveis de ambiente.

**Backend** precisa de `AUTH_ENTRA_TENANT_ID`, `AUTH_ENTRA_CLIENT_ID`, `AUTH_ENTRA_API_AUDIENCE` (URI ou client id do token de acesso).

**Frontend** precisa de `AUTH_MICROSOFT_ENTRA_ID_*`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_ENTRA_API_SCOPE`.

---

## 5) Configurar localhost

### Backend
```bash
cd backend
cp .env.production.example .env   # ou crie .env mínimo
# Ajuste:
# AUTH_ENTRA_ENABLED=true
# AUTH_MASTER_ENABLED=true
# AUTH_ENTRA_TENANT_ID=...
# AUTH_ENTRA_CLIENT_ID=...
# AUTH_ENTRA_API_AUDIENCE=api://...
python manage.py migrate
python manage.py ensure_master_admin --rotate-password
python manage.py runserver
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_AUTH_ENTRA_ENABLED=true
# AUTH_* e AUTH_MICROSOFT_* preenchidos
# AUTH_ENTRA_API_SCOPE=api://<client-id>/access_as_user
npm install --legacy-peer-deps
npm run dev
```

Acesse `http://localhost:3000/login` (Microsoft) e `http://localhost:3000/admin-master` (master).

---

## 6) Produção CloudPanel / VPS

1. Backend `.env`: flags Entra/Master + claims Entra (ver `.env.production.example`).
2. Frontend `.env.production`: Auth.js + `NEXT_PUBLIC_AUTH_ENTRA_ENABLED=true` + `AUTH_TRUST_HOST=true`.
3. Redirect URI de produção no Entra (acima).
4. Confirme no proxy CloudPanel: `X-Forwarded-Proto: https` e `Host` corretos (já previsto em `deploy/nginx.conf`).
5. Deploy usual (`deploy/cloudpanel/deploy-server.sh` / `deploy-frontend.sh`) + `migrate` + `ensure_master_admin` (ou `ensure-admin.sh`).
6. Cookies/sessão: Auth.js emite `__Secure-authjs.session-token` em HTTPS; API continua com Bearer SimpleJWT.

### Rollout flaggeado (recomendado)

| Etapa | Backend | Frontend | Objetivo |
|-------|---------|----------|----------|
| A | `AUTH_MASTER_ENABLED=true` | — | Super Admin em `/admin-master` |
| B | `AUTH_ENTRA_ENABLED=true` (staging) | `NEXT_PUBLIC_AUTH_ENTRA_ENABLED=true` | Validar exchange |
| C | Produção Entra ON | Entra ON | Colaboradores via Microsoft |
| D | `AUTH_LEGACY_LOGIN_MASTER_ONLY=true` | — | `/auth/login/json` só master |
| E | `python manage.py deactivate_legacy_passwords` | — | Remove senhas LEGACY |
| F | `AUTH_LEGACY_PASSWORD_LOGIN=false` | — | Desliga login senha colaborador |

**App Android online (MSAL)** fica para fase posterior; offline localAuth não muda.

---

## 7) Criar o primeiro Super Administrador

```bash
cd backend
python manage.py ensure_master_admin \
  --email admin@ssma.com.br \
  --password 'SENHA_FORTE' \
  --name 'Administrador SSMA' \
  --rotate-password
```

O usuário ficará com `auth_source=INTERNAL_MASTER` e `role=SUPER_ADMIN`.

Login: `https://inspecao.iadvh.org.br/admin-master`

Não documente senhas reais no README; use o command + variáveis `ADMIN_*` no servidor.

---

## 8) Adicionar novos perfis

1. Crie App Role no Entra (nome igual ao papel interno, ex.: `AUDITOR`).
2. Atribua a role aos usuários/grupos no Enterprise Application.
3. O mapeamento está em `accounts/services/audit.py` → `map_entra_roles`.
4. Para novos papéis: adicione em `AppRole` (models) + migration + entrada no mapeamento + regras de permissão nas views (`IsInternalMaster` / `IsEntraCollaborator` quando aplicável).

---

## 9) Multiempresa (tenants) no futuro

- Identidade Entra já usa chave `(tenant_id, object_id)` — nunca só e-mail.
- Configure `AUTH_ENTRA_ALLOWED_TENANTS=tid1,tid2`.
- Evolução: tabela `Organization` ligada a `tenant_id` + scoping de inspeções/unidades por organização (não implementado nesta entrega).

---

## 10) Compatibilidade Next.js / Django / Auth.js

- Auth.js (`next-auth` v5) só no build **standalone** web; Capacitor usa `build:mobile` que remove rotas Auth.js.
- API continua SimpleJWT → pouca mudança em SyncEngine / downloads / `AuthImage`.
- Instale `next-auth` com `--legacy-peer-deps` enquanto o peer oficial não listar Next 16.
- Django 5 + SimpleJWT blacklist: rode migrations `token_blacklist` e `accounts.0002_dual_auth`.
- Não misture identidade offline do tablet com Master web.
- PKCE + Authorization Code no provider Entra; refresh Auth.js (sessão) + refresh SimpleJWT pós-exchange.

---

## Endpoints novos

| Método | Path | Uso |
|--------|------|-----|
| POST | `/auth/entra/exchange` | Troca token Entra → SimpleJWT |
| POST | `/auth/master/login` | Login Super Admin |
| POST | `/auth/master/token/refresh` | Refresh master |
| POST | `/auth/master/logout` | Logout + blacklist |
| POST | `/auth/token/refresh` | Refresh (contrato `access_token`) |
| POST | `/auth/login/json` | Legado (feature-flagged) |
