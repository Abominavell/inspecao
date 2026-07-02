from __future__ import annotations

from datetime import date
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

from inspections.models import ChecklistItem, Inspection, InspectionAnswer, Photo, Unit
from inspections.services.cover import default_cover_fields
from inspections.services.sample_assets import SAMPLE_IMAGES, ensure_sample_images
from inspections.services.validation import validate_inspection_for_report

SAMPLE_UNIT = {
    "name": "EMSERH ANEXO II",
    "regional": "Norte",
    "city": "São Luís/MA",
    "address": "Av. Borborema, 440 - Calhau, São Luís - MA, 65071-250",
    "unit_type": "Prédio Administrativo",
    "employee_count": 86,
    "admin_coordinator": "Fernanda França Ribeiro de Oliveira",
    "general_director": "Jorge Carlos Araújo de Araújo",
    "characterization": """A Infraestrutura da Unidade é composta por:
Recepção: Destinada ao atendimento de pacientes e funcionários em geral.
Sala de Espera: Destinado a capacitação e reunião de funcionários.
Sala de triagem: Destinada a triagem dos pacientes para atendimento.
Consultórios: Destinados ao atendimento de Funcionários Emserh.
Copa: Destinada a realização das refeições dos funcionários.
OBS: As informações foram repassadas pela coordenadora administrativa Fernanda França.""",
}

SAMPLE_TEXTS = {
    "general_info_text": (
        "Este Relatório Técnico de Diagnóstico de Saúde e Segurança do Trabalho foi realizado "
        "na unidade EMSERH ANEXO II, composta por:"
    ),
    "methodology_text": """Diretrizes utilizadas para levantamento de dados e definição dos problemas:
Realizar vistoria "in loco" das estruturas, laboratórios, sistemas de abastecimento de água/esgoto e sistemas de armazenamento de resíduos identificados na unidade;
Avaliar a conformidade das documentações e requisitos legais;
Verificar a aderência às conformidades e à aplicação do método Ver e Agir;
Identificar os aspectos e impactos ambientais da unidade;
Realizar registro fotográfico para documentação visual.""",
    "objectives_text": """Realizar aplicação de CheckList de Diagnóstico Ambiental e Saúde e Segurança do Trabalho para mapear as não conformidades encontradas;
Avaliar a aderência de conformidades e apresentar os resultados;
Levantar os desvios e respectivos requisitos legais aplicáveis;
Associar os desvios a ações preventivas e corretivas, com respectivo prazo;
Apresentar os principais aspectos e impactos ambientais da unidade.""",
    "limitations_text": """Este relatório baseia-se nas informações e condições observadas no momento da inspeção;
Eventuais alterações posteriores na unidade podem modificar o panorama de conformidades;
Documentos não apresentados durante a vistoria não foram avaliados.""",
    "final_considerations_text": """A inspeção identificou pontos de conformidade e não conformidades que demandam plano de ação;
Recomenda-se priorizar as NC com registro fotográfico e exigência normativa;
A unidade deve acompanhar a implementação das recomendações com prazos definidos.""",
}

# Itens NC com texto e foto (conforme modelo Anexo I)
SAMPLE_NC: dict[str, dict] = {
    "1.2": {
        "description": "Existe acúmulo de material no perímetro do prédio.",
        "recommendation": "Realizar a organização do restante de material no entorno do prédio.",
        "normative": "NR-1 — Gerenciamento de riscos ocupacionais",
        "photo": "nc_material_acumulado.jpg",
    },
    "1.5": {
        "description": "Estacionamento sem demarcações adequada e placa de identificação de estacionamento de ré.",
        "recommendation": "Delimitar e sinalizar o estacionamento para facilitar a evacuação da unidade em caso de emergência.",
        "normative": "NR-23 — Proteção contra incêndios",
        "photo": "nc_estacionamento.jpg",
    },
    "1.6": {
        "description": "As estruturas que estão expostas ao risco de colisão com veículo não possuem proteções adequadas (barreiras físicas).",
        "recommendation": "Realizar a colocação de placas de sinalização do local, demarcação da distância segura e providenciar proteção.",
        "normative": "NR-12 — Segurança no trabalho em máquinas e equipamentos",
        "photo": "nc_protecao_colisao.jpg",
    },
    "11.1": {
        "description": "Localizado fios desorganizados nos setores administrativos.",
        "recommendation": "Organizar a fiação elétrica e providenciar eletrodutos/canaletas adequados.",
        "normative": "NR-10 — Segurança em instalações e serviços em eletricidade",
        "photo": "nc_fios_desorganizados.jpg",
    },
}

EXTRA_NC_CODES = ["2.1", "4.3", "12.2", "14.1"]


class Command(BaseCommand):
    help = "Cria inspeção de exemplo completa com fotos NC (EMSERH ANEXO II)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove inspeção de exemplo existente e recria do zero",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        user = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if not user:
            self.stderr.write("Nenhum usuário encontrado. Execute createsuperuser primeiro.")
            return

        if ChecklistItem.objects.count() == 0:
            self.stderr.write("Checklist vazio. Execute: python manage.py seed_checklist")
            return

        sample_dir = ensure_sample_images()
        self.stdout.write(f"Imagens de exemplo em: {sample_dir}")

        unit, _ = Unit.objects.update_or_create(
            name=SAMPLE_UNIT["name"],
            defaults=SAMPLE_UNIT,
        )

        inspection_qs = Inspection.objects.filter(
            unit=unit,
            inspection_date=date(2023, 10, 10),
        )
        if options["reset"]:
            for insp in inspection_qs:
                for answer in insp.answers.prefetch_related("photos"):
                    for photo in answer.photos.all():
                        if photo.image:
                            photo.image.delete(save=False)
                insp.delete()
            self.stdout.write("Inspeção de exemplo anterior removida.")

        inspection = inspection_qs.first()
        if inspection:
            self.stdout.write(f"Inspeção de exemplo já existe (id={inspection.id}). Use --reset para recriar.")
            return

        cover = default_cover_fields()
        inspection = Inspection.objects.create(
            unit=unit,
            created_by=user,
            inspection_date=date(2023, 10, 10),
            report_date=date(2023, 10, 16),
            status=Inspection.Status.RASCUNHO,
            **cover,
            **SAMPLE_TEXTS,
        )

        items = list(ChecklistItem.objects.select_related("section").order_by("section__order", "order"))

        for item in items:
            code = item.item_code
            if code in SAMPLE_NC:
                data = SAMPLE_NC[code]
                answer = InspectionAnswer.objects.create(
                    inspection=inspection,
                    checklist_item=item,
                    status=InspectionAnswer.AnswerStatus.NC,
                    description=data["description"],
                    recommendation=data["recommendation"],
                    normative=data["normative"],
                )
                photo_name = data["photo"]
                photo_path = sample_dir / photo_name
                if photo_path.exists():
                    content = photo_path.read_bytes()
                    photo = Photo(answer=answer, original_filename=photo_name)
                    photo.image.save(photo_name, ContentFile(content), save=True)
            elif code in EXTRA_NC_CODES:
                InspectionAnswer.objects.create(
                    inspection=inspection,
                    checklist_item=item,
                    status=InspectionAnswer.AnswerStatus.NC,
                    description=f"Não conformidade identificada no item {code} durante a vistoria.",
                    recommendation="Providenciar adequação conforme requisitos legais aplicáveis.",
                    normative="NR aplicável ao item",
                )
            elif code.endswith(".4") or code.endswith(".7"):
                InspectionAnswer.objects.create(
                    inspection=inspection,
                    checklist_item=item,
                    status=InspectionAnswer.AnswerStatus.NA,
                )
            else:
                InspectionAnswer.objects.create(
                    inspection=inspection,
                    checklist_item=item,
                    status=InspectionAnswer.AnswerStatus.C,
                )

        errors = validate_inspection_for_report(inspection)
        photo_count = Photo.objects.filter(answer__inspection=inspection).count()
        nc_count = inspection.answers.filter(status=InspectionAnswer.AnswerStatus.NC).count()

        self.stdout.write(self.style.SUCCESS(f"Unidade: {unit.name} (id={unit.id})"))
        self.stdout.write(self.style.SUCCESS(f"Inspeção de exemplo criada: id={inspection.id}"))
        self.stdout.write(f"  Itens respondidos: {inspection.answers.count()}/{len(items)}")
        self.stdout.write(f"  Não conformidades: {nc_count}")
        self.stdout.write(f"  Fotos NC anexadas: {photo_count}")
        if errors:
            self.stdout.write(self.style.WARNING("Pendências para PDF:"))
            for err in errors[:10]:
                self.stdout.write(f"  - {err}")
        else:
            self.stdout.write(self.style.SUCCESS("Pronta para gerar PDF na etapa Relatório."))
        self.stdout.write(f"\nAcesse: /inspecoes/{inspection.id}/dados")
