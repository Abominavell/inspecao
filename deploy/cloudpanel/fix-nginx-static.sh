#!/usr/bin/env bash
set -euo pipefail

CONF="/etc/nginx/sites-enabled/apiinspecao.iadvh.org.br.conf"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("/etc/nginx/sites-enabled/apiinspecao.iadvh.org.br.conf")
text = p.read_text()

static_block = """  location ^~ /static/ {
    alias /home/iadvh-apiinspecao/htdocs/apiinspecao.iadvh.org.br/backend/staticfiles/;
    expires 30d;
    add_header Cache-Control "public";
    access_log off;
  }

"""

text = re.sub(
    r"\n  location \^~ /static/ \{.*?\n  \}\n",
    "\n" + static_block,
    text,
    count=1,
    flags=re.DOTALL,
)

if "location /static/" not in text:
    text = text.replace("  location / {\n", static_block + "  location / {\n", 1)

p.write_text(text)
print("nginx static block OK")
PY

nginx -t
systemctl reload nginx
curl -sfI "https://apiinspecao.iadvh.org.br/static/admin/css/base.css" | head -3
