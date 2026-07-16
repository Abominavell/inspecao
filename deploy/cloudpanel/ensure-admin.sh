#!/usr/bin/env bash
set -euo pipefail
cd /home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend
source .venv/bin/activate

# Bootstrap / promoção do Super Admin interno (INTERNAL_MASTER)
python manage.py ensure_master_admin --rotate-password

python manage.py shell <<'PY'
from django.contrib.auth import get_user_model

for u in get_user_model().objects.filter(is_superuser=True):
    print(
        f"superuser: {u.email} | staff={u.is_staff} | "
        f"auth_source={getattr(u, 'auth_source', '?')} | role={getattr(u, 'role', '?')}"
    )
PY
