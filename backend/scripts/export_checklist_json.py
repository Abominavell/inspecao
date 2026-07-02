"""Exporta Anexo IV (xlsx) para JSON embutido no repositório."""
import sys
from pathlib import Path

import django

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///data/db.sqlite3")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from inspections.services.checklist_seed import parse_checklist_xlsx  # noqa: E402


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / (
        "Anexo IV - Check  List - Diagnóstico de Saúde e Segurança.xlsx"
    )
    out = BACKEND / "inspections" / "data" / "checklist_anexo_iv.json"
    sections = parse_checklist_xlsx(xlsx)
    import json

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"sections": sections}, ensure_ascii=False, indent=2), encoding="utf-8")
    items = sum(len(s["items"]) for s in sections)
    print(f"Wrote {len(sections)} sections, {items} items to {out}")


if __name__ == "__main__":
    main()
