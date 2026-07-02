#!/usr/bin/env python
"""Detalhe de um item NC. Uso: python scripts/check_nc_photo.py 5 1.1"""
import os
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from inspections.models import ChecklistItem, Inspection, InspectionAnswer  # noqa: E402


def main() -> None:
    insp_id = int(sys.argv[1])
    code = sys.argv[2] if len(sys.argv) > 2 else "1.1"
    i = Inspection.objects.get(pk=insp_id)
    item = ChecklistItem.objects.filter(item_code=code).first()
    print(f"Inspection #{insp_id} item {code} id={item.id if item else None}")
    if not item:
        return
    a = InspectionAnswer.objects.filter(inspection=i, checklist_item_id=item.id).first()
    if not a:
        print("no answer")
        return
    print("status:", a.status, "desc:", bool(a.description.strip()), "rec:", bool(a.recommendation.strip()))
    print("photos:", a.photos.count())


if __name__ == "__main__":
    main()
