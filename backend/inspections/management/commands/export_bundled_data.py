"""Exporta checklist, SSMA e unidades para o app Android offline."""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from inspections.models import Unit
from inspections.services.checklist_seed import load_checklist_sections
from inspections.services.ssma_config import load_ssma_config


class Command(BaseCommand):
    help = "Exporta JSON embutidos para frontend/public/data/ (app tablet offline)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--out",
            type=str,
            default="",
            help="Pasta de saída (padrão: ../frontend/public/data relativo ao backend)",
        )

    def handle(self, *args, **options):
        backend = Path(__file__).resolve().parents[3]
        out_dir = Path(options["out"]) if options["out"] else backend.parent / "frontend" / "public" / "data"
        out_dir.mkdir(parents=True, exist_ok=True)

        checklist_raw = {"sections": load_checklist_sections()}
        (out_dir / "checklist.json").write_text(
            json.dumps(checklist_raw, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        ssma = load_ssma_config()
        (out_dir / "ssma.json").write_text(
            json.dumps(ssma, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        units = list(
            Unit.objects.order_by("name").values(
                "id",
                "name",
                "regional",
                "city",
                "address",
                "unit_type",
                "employee_count",
                "admin_coordinator",
                "general_director",
                "characterization",
                "created_at",
            )
        )
        for u in units:
            if u.get("created_at"):
                u["created_at"] = u["created_at"].isoformat()
        (out_dir / "units.json").write_text(
            json.dumps(units, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        self.stdout.write(self.style.SUCCESS(f"Exportado em {out_dir}"))
        self.stdout.write(f"  checklist: {len(checklist_raw['sections'])} seções")
        self.stdout.write(f"  units: {len(units)} unidades")
