#!/usr/bin/env python
"""Diagnóstico do cabeçalho do PDF. Uso: python scripts/check_pdf_header.py [inspection_id]"""
import os
import sys

import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings  # noqa: E402
from inspections.models import Inspection  # noqa: E402
from inspections.services.pdf import _file_to_data_uri, _resolve_pdf_engine, generate_report_pdf  # noqa: E402


def main() -> None:
    pk = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    static_dir = settings.BASE_DIR / "static" / "report"
    logo = static_dir / "emserh-logo.png"
    banner = static_dir / "report-header.png"
    print("engine:", _resolve_pdf_engine())
    print("static_dir:", static_dir, "exists:", static_dir.exists())
    print("logo:", logo.exists(), "banner:", banner.exists())
    print("logo_uri:", bool(_file_to_data_uri(logo, max_width=200)))
    print("banner_uri:", bool(_file_to_data_uri(banner, max_width=720)))
    insp = Inspection.objects.select_related("unit").get(pk=pk)
    pdf = generate_report_pdf(insp)
    out = settings.BASE_DIR / "uploads" / f"_test_header_{pk}.pdf"
    out.write_bytes(pdf)
    print("pdf_bytes:", len(pdf), "written:", out)


if __name__ == "__main__":
    main()
