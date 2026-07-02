from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand

from inspections.services.checklist_seed import load_checklist_sections, seed_checklist_sections

DEFAULT_XLSX = Path.home() / "Downloads" / "Anexo IV - Check  List - Diagnóstico de Saúde e Segurança.xlsx"


class Command(BaseCommand):
    help = "Importa checklist do Anexo IV (JSON embutido ou Excel opcional)"

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            nargs="?",
            type=str,
            help="Caminho opcional do .xlsx. Sem arquivo, usa checklist embutido no código.",
        )
        parser.add_argument(
            "--checklist-version",
            dest="checklist_version",
            type=str,
            default="",
            help="Identificador da versão (ex: 2024-03). Padrão: data atual ou anexo-iv",
        )
        parser.add_argument(
            "--activate",
            action="store_true",
            help="Define esta versão como ativa para novas inspeções",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Apaga versões antigas e recria do zero",
        )

    def handle(self, *args, **options):
        xlsx_path = Path(options["file"]) if options.get("file") else None
        try:
            sections = load_checklist_sections(xlsx_path=xlsx_path)
        except FileNotFoundError as exc:
            self.stderr.write(str(exc))
            return

        source = str(xlsx_path) if xlsx_path else "checklist embutido (Anexo IV)"
        version_slug = options["checklist_version"] or (
            date.today().strftime("%Y-%m") if xlsx_path else "anexo-iv"
        )
        activate = options["activate"] if options["activate"] else None

        version, section_count, item_count, created = seed_checklist_sections(
            sections,
            version_slug=version_slug,
            activate=activate,
            replace=options["replace"],
        )

        if not created:
            self.stdout.write(
                self.style.WARNING(
                    f"Versão {version_slug} já possui checklist. Use outro --checklist-version ou --replace."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Versão {version_slug}: {section_count} seções e {item_count} itens ({source})"
            )
        )
