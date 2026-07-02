# Plataforma de Inspeção de Segurança e Relatório SSMA

Plataforma web para preenchimento digital do checklist de diagnóstico (Anexo IV) e geração automática do relatório técnico em PDF (Anexo I).

## Stack

- **Backend:** Python 3.12, **Django 5** + **Django REST Framework**, SQLite
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS
- **PDF:** Jinja2 + WeasyPrint (Linux/Docker) com fallback xhtml2pdf (Windows)

## Pré-requisitos

- [Python 3.12](https://www.python.org/downloads/)
- [Node.js 22+](https://nodejs.org/)

## Configuração rápida (Windows)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
# checklist Anexo IV é importado automaticamente no primeiro migrate

python manage.py runserver
```

Frontend (outro terminal):

```powershell
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:3000 — Login: `admin@ssma.com.br` / `admin123`

## Comandos Django

| Comando | Descrição |
|---------|-----------|
| `python manage.py runserver` | Inicia a API em http://127.0.0.1:8000 |
| `python manage.py migrate` | Aplica migrações do banco |
| `python manage.py seed_checklist` | Importa checklist embutido (Anexo IV) ou de um `.xlsx` opcional |
| `python manage.py createsuperuser` | Cria usuário admin adicional |

## Fluxo de uso

Os anexos são **modelos de referência**. O usuário preenche todas as informações manualmente.

1. Cadastre a **unidade**
2. Crie uma **inspeção**
3. Preencha **dados** (unidade + textos do relatório)
4. Complete o **checklist** (todos os itens; em NC preencha os campos e use **Tirar foto** com a câmera do tablet)
5. Gere o **PDF** na etapa Relatório (somente quando completo)

## Variáveis de ambiente

Copie `.env.example` para `backend/.env`:

```
SECRET_KEY=sua-chave-secreta
CORS_ORIGINS=http://localhost:3000
ADMIN_EMAIL=admin@ssma.com.br
ADMIN_PASSWORD=admin123
```

## Docker

```bash
docker compose up --build
```

## Deploy em produção

- **CloudPanel (API):** [docs/deploy-cloudpanel-backend.md](docs/deploy-cloudpanel-backend.md) — `apiinspecao.iadvh.org.br`, porta **8011**
- **CloudPanel (frontend):** [docs/deploy-cloudpanel-frontend.md](docs/deploy-cloudpanel-frontend.md) — `inspecao.iadvh.org.br`, porta **3011**
- **VPS + Docker:** [docs/deploy.md](docs/deploy.md) — Nginx na porta 80

## Pontuação

Por seção: `C / (C + NC + NA)` — mesma regra do Excel Anexo IV.
