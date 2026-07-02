#!/usr/bin/env python
"""Diagnóstico de pendências de uma inspeção. Uso: python scripts/check_inspection_pending.py 5"""
import os
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from inspections.models import Inspection  # noqa: E402
from inspections.services.validation import get_pending_items, inspection_progress  # noqa: E402


def main() -> None:
    pk = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    i = Inspection.objects.select_related("unit").prefetch_related("answers__photos").get(pk=pk)
    p = inspection_progress(i)
    print(f"Inspection #{pk} — {i.unit.name}")
    print("ready_for_report:", p["ready_for_report"])
    print(
        "checklist:",
        p["checklist_answered"],
        "/",
        p["checklist_total"],
        "complete:",
        p["checklist_complete"],
    )
    print("unit:", p["unit_complete"], "photo:", p["address_photo_complete"])
    print("cover:", p["cover_complete"], "texts:", p["texts_complete"])
    print("pending_count:", p["pending_count"])
    print("--- cover fields on record ---")
    for field in [
        "cover_diretoria_executiva",
        "cover_diretor_executivo",
        "cover_gerencia_geral",
        "cover_gerente_geral",
        "cover_gerencia_sst",
        "cover_gerente_sst",
        "cover_gerencia_meio_ambiente",
        "cover_gerente_meio_ambiente",
    ]:
        val = getattr(i, field, "")
        print(f"  {field}: {repr(val)[:80]}")
    print("--- pending ---")
    for item in get_pending_items(i):
        print("-", item)


if __name__ == "__main__":
    main()
