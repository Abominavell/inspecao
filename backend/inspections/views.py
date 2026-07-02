import re
import uuid

from django.http import FileResponse, Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from inspections.models import ChecklistSection, Inspection, InspectionAnswer, Photo, Unit
from inspections.permissions import IsStaffOrInspectionOwner
from inspections.serializers import (
    AnswerSerializer,
    AnswersBatchSerializer,
    ChecklistSectionSerializer,
    CompletenessSerializer,
    InspectionSerializer,
    NonConformitySerializer,
    PhotoSerializer,
    ScoresSerializer,
    UnitSerializer,
)
from inspections.services.audit import log_inspection_action
from inspections.services.checklist_version import resolve_checklist_version
from inspections.services.cover import default_cover_fields
from inspections.services.pdf import generate_report_pdf
from inspections.services.scoring import compute_section_scores, get_non_conformities
from inspections.services.ssma_config import load_ssma_config
from inspections.services.validation import inspection_progress, validate_inspection_for_report
from inspections.services.workflow import ensure_inspection_editable, ensure_inspection_owner_or_staff

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def ssma_config(request):
    return Response(load_ssma_config())


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer


class InspectionViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionSerializer
    permission_classes = [IsStaffOrInspectionOwner]

    def get_queryset(self):
        qs = Inspection.objects.select_related("unit", "created_by", "checklist_version").order_by(
            "-created_at"
        )
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(created_by=user)

        archived = self.request.query_params.get("archived", "false")
        if archived == "true":
            qs = qs.filter(is_archived=True)
        elif archived != "all":
            qs = qs.filter(is_archived=False)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        unit_id = self.request.query_params.get("unit_id")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)

        regional = self.request.query_params.get("regional")
        if regional:
            qs = qs.filter(unit__regional__icontains=regional)

        mine = self.request.query_params.get("mine")
        if mine == "true":
            qs = qs.filter(created_by=user)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(unit__name__icontains=search)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(inspection_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(inspection_date__lte=date_to)

        return qs

    def get_object(self):
        obj = super().get_object()
        ensure_inspection_owner_or_staff(obj, self.request.user)
        return obj

    def perform_create(self, serializer):
        inspection = serializer.save()
        log_inspection_action(inspection, self.request.user, "created", "Inspeção criada")

    def perform_update(self, serializer):
        inspection = self.get_object()
        if inspection.is_archived:
            raise ValidationError("Inspeção arquivada não pode ser editada")
        if inspection.status == Inspection.Status.FINALIZADO:
            if not self.request.user.is_staff:
                raise ValidationError("Inspeção finalizada não pode ser editada")
            if set(serializer.validated_data.keys()) - {"status"}:
                raise ValidationError("Reabra a inspeção antes de editar outros campos")
        inspection = serializer.save()
        log_inspection_action(inspection, self.request.user, "updated", "Dados da inspeção atualizados")

    def perform_destroy(self, instance):
        if not self.request.user.is_staff:
            raise PermissionDenied("Somente administradores podem excluir inspeções")
        log_inspection_action(instance, self.request.user, "deleted", "Inspeção excluída")
        super().perform_destroy(instance)

    def _editable(self, inspection: Inspection) -> None:
        ensure_inspection_owner_or_staff(inspection, self.request.user)
        ensure_inspection_editable(inspection, self.request.user)

    @action(detail=True, methods=["get", "put"], url_path="answers")
    def answers(self, request, pk=None):
        inspection = self.get_object()
        if request.method == "GET":
            qs = inspection.answers.select_related("checklist_item").prefetch_related("photos")
            data = AnswerSerializer(qs, many=True, context={"request": request}).data
            return Response(data)

        self._editable(inspection)
        batch = AnswersBatchSerializer(data=request.data)
        batch.is_valid(raise_exception=True)

        existing = {a.checklist_item_id: a for a in inspection.answers.all()}
        changed = 0
        for item in batch.validated_data["answers"]:
            status_val = item.get("status")
            if status_val == InspectionAnswer.AnswerStatus.NC:
                if not item.get("description", "").strip():
                    raise ValidationError(
                        f"Descrição obrigatória para item NC (checklist_item_id={item['checklist_item_id']})"
                    )
                if not item.get("recommendation", "").strip():
                    raise ValidationError(
                        f"Recomendação obrigatória para item NC (checklist_item_id={item['checklist_item_id']})"
                    )

            answer = existing.get(item["checklist_item_id"])
            if answer:
                answer.status = status_val
                answer.description = item.get("description", "")
                answer.recommendation = item.get("recommendation", "")
                answer.normative = item.get("normative", "")
                answer.save()
                changed += 1
            else:
                InspectionAnswer.objects.create(
                    inspection=inspection,
                    checklist_item_id=item["checklist_item_id"],
                    status=status_val,
                    description=item.get("description", ""),
                    recommendation=item.get("recommendation", ""),
                    normative=item.get("normative", ""),
                )
                changed += 1

        log_inspection_action(
            inspection,
            request.user,
            "answers_updated",
            f"{changed} resposta(s) atualizada(s)",
        )
        qs = inspection.answers.select_related("checklist_item").prefetch_related("photos")
        return Response(AnswerSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="scores")
    def scores(self, request, pk=None):
        inspection = self.get_object()
        return Response(compute_section_scores(inspection))

    @action(detail=True, methods=["get"], url_path="non-conformities")
    def non_conformities(self, request, pk=None):
        inspection = self.get_object()
        return Response(get_non_conformities(inspection))

    @action(detail=True, methods=["get"], url_path="completeness")
    def completeness(self, request, pk=None):
        inspection = self.get_object()
        progress = inspection_progress(inspection)
        errors = validate_inspection_for_report(inspection)
        return Response({**progress, "errors": errors})

    @action(
        detail=True,
        methods=["post"],
        url_path="photos",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_photo(self, request, pk=None):
        inspection = self.get_object()
        self._editable(inspection)
        answer_id = request.data.get("answer_id")
        checklist_item_id = request.data.get("checklist_item_id")
        file = request.FILES.get("file")
        if not file or (not answer_id and not checklist_item_id):
            raise ValidationError("Informe answer_id ou checklist_item_id e envie o arquivo")

        content_type = file.content_type or ""
        if content_type and content_type not in ALLOWED_IMAGE_TYPES:
            raise ValidationError("Apenas JPEG e PNG são permitidos")
        if file.size > MAX_UPLOAD_SIZE:
            raise ValidationError("Arquivo excede 5 MB")

        if answer_id:
            try:
                answer = InspectionAnswer.objects.get(id=answer_id, inspection=inspection)
            except InspectionAnswer.DoesNotExist:
                raise Http404("Resposta não encontrada")
        else:
            answer, created = InspectionAnswer.objects.get_or_create(
                inspection=inspection,
                checklist_item_id=checklist_item_id,
                defaults={"status": InspectionAnswer.AnswerStatus.NC},
            )
            if not created and answer.status != InspectionAnswer.AnswerStatus.NC:
                raise ValidationError("Fotos NC só podem ser vinculadas a itens marcados como NC")

        if answer.status != InspectionAnswer.AnswerStatus.NC:
            answer.status = InspectionAnswer.AnswerStatus.NC
            answer.save(update_fields=["status"])

        ext = "." + file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ".jpg"
        if ext not in (".jpg", ".jpeg", ".png"):
            ext = ".jpg"
        original_name = file.name
        file.name = f"{uuid.uuid4().hex}{ext}"

        photo = Photo.objects.create(
            answer=answer,
            image=file,
            original_filename=original_name,
        )
        log_inspection_action(
            inspection,
            request.user,
            "photo_uploaded",
            f"Foto NC item {answer.checklist_item_id}",
        )
        return Response(
            PhotoSerializer(photo, context={"request": request, "inspection_id": inspection.id}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "delete"], url_path=r"photos/(?P<photo_id>[^/.]+)")
    def photo_detail(self, request, pk=None, photo_id=None):
        inspection = self.get_object()
        try:
            photo = Photo.objects.select_related("answer").get(
                id=photo_id, answer__inspection=inspection
            )
        except Photo.DoesNotExist:
            raise Http404("Foto não encontrada")

        if request.method == "DELETE":
            self._editable(inspection)
            if photo.image:
                photo.image.delete(save=False)
            photo.delete()
            log_inspection_action(inspection, request.user, "photo_deleted", f"Foto {photo_id}")
            return Response(status=status.HTTP_204_NO_CONTENT)

        if not photo.image:
            raise Http404("Foto não encontrada")
        return FileResponse(photo.image.open("rb"), content_type=f"image/{photo.image.name.split('.')[-1]}")

    def _validate_image_upload(self, file):
        content_type = file.content_type or ""
        if content_type and content_type not in ALLOWED_IMAGE_TYPES:
            raise ValidationError("Apenas JPEG e PNG são permitidos")
        if file.size > MAX_UPLOAD_SIZE:
            raise ValidationError("Arquivo excede 5 MB")

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="address-photo",
        parser_classes=[MultiPartParser, FormParser],
    )
    def address_photo(self, request, pk=None):
        inspection = self.get_object()

        if request.method == "GET":
            if not inspection.address_photo:
                raise Http404("Foto do local não encontrada")
            ext = inspection.address_photo.name.rsplit(".", 1)[-1].lower()
            content_type = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
            return FileResponse(inspection.address_photo.open("rb"), content_type=content_type)

        if request.method == "DELETE":
            self._editable(inspection)
            if inspection.address_photo:
                inspection.address_photo.delete(save=False)
                inspection.address_photo = None
                inspection.save(update_fields=["address_photo", "updated_at"])
            log_inspection_action(inspection, request.user, "address_photo_deleted", "")
            return Response(status=status.HTTP_204_NO_CONTENT)

        self._editable(inspection)
        file = request.FILES.get("file")
        if not file:
            raise ValidationError("Envie o arquivo da foto")
        self._validate_image_upload(file)

        ext = "." + file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ".jpg"
        if ext not in (".jpg", ".jpeg", ".png"):
            ext = ".jpg"
        file.name = f"local_{uuid.uuid4().hex}{ext}"

        if inspection.address_photo:
            inspection.address_photo.delete(save=False)
        inspection.address_photo = file
        inspection.save(update_fields=["address_photo", "updated_at"])
        log_inspection_action(inspection, request.user, "address_photo_uploaded", "")
        return Response({"has_address_photo": True}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="report/pdf")
    def report_pdf(self, request, pk=None):
        inspection = self.get_object()
        if inspection.status != Inspection.Status.FINALIZADO:
            errors = validate_inspection_for_report(inspection)
            if errors:
                return Response(
                    {"detail": {"message": "Inspeção incompleta", "errors": errors}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        pdf_bytes = generate_report_pdf(inspection)
        if inspection.status != Inspection.Status.FINALIZADO:
            inspection.status = Inspection.Status.FINALIZADO
            inspection.save(update_fields=["status", "updated_at"])
            log_inspection_action(inspection, request.user, "finalized", "PDF gerado")
        unit_name = re.sub(r"[^\w\-]", "_", inspection.unit.name)[:50]
        filename = f"relatorio_{unit_name}_{inspection.inspection_date}.pdf"
        response = FileResponse(
            iter([pdf_bytes]),
            content_type="application/pdf",
            as_attachment=True,
            filename=filename,
        )
        return response

    @action(detail=True, methods=["post"], url_path="reopen", permission_classes=[IsAdminUser])
    def reopen(self, request, pk=None):
        inspection = self.get_object()
        if inspection.status != Inspection.Status.FINALIZADO:
            raise ValidationError("Apenas inspeções finalizadas podem ser reabertas")
        inspection.status = Inspection.Status.RASCUNHO
        inspection.save(update_fields=["status", "updated_at"])
        log_inspection_action(inspection, request.user, "reopened", "Inspeção reaberta")
        return Response(InspectionSerializer(inspection, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        inspection = self.get_object()
        ensure_inspection_owner_or_staff(inspection, request.user)
        inspection.is_archived = True
        inspection.save(update_fields=["is_archived", "updated_at"])
        log_inspection_action(inspection, request.user, "archived", "Inspeção arquivada")
        return Response(InspectionSerializer(inspection, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="unarchive", permission_classes=[IsAdminUser])
    def unarchive(self, request, pk=None):
        inspection = self.get_object()
        inspection.is_archived = False
        inspection.save(update_fields=["is_archived", "updated_at"])
        log_inspection_action(inspection, request.user, "unarchived", "Inspeção desarquivada")
        return Response(InspectionSerializer(inspection, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, pk=None):
        source = self.get_object()
        ensure_inspection_owner_or_staff(source, request.user)
        clone = Inspection.objects.create(
            unit=source.unit,
            created_by=request.user,
            inspection_date=source.inspection_date,
            report_date=source.report_date,
            status=Inspection.Status.RASCUNHO,
            checklist_version=source.checklist_version,
            methodology_text=source.methodology_text,
            objectives_text=source.objectives_text,
            limitations_text=source.limitations_text,
            final_considerations_text=source.final_considerations_text,
            general_info_text=source.general_info_text,
            cover_diretoria_executiva=source.cover_diretoria_executiva,
            cover_diretor_executivo=source.cover_diretor_executivo,
            cover_gerencia_geral=source.cover_gerencia_geral,
            cover_gerente_geral=source.cover_gerente_geral,
            cover_gerencia_sst=source.cover_gerencia_sst,
            cover_gerente_sst=source.cover_gerente_sst,
            cover_gerencia_meio_ambiente=source.cover_gerencia_meio_ambiente,
            cover_gerente_meio_ambiente=source.cover_gerente_meio_ambiente,
        )
        log_inspection_action(clone, request.user, "cloned", f"Clonada da inspeção {source.id}")
        return Response(
            InspectionSerializer(clone, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="audit-log")
    def audit_log(self, request, pk=None):
        inspection = self.get_object()
        logs = inspection.audit_logs.select_related("user").order_by("-created_at")[:100]
        data = [
            {
                "id": log.id,
                "action": log.action,
                "details": log.details,
                "user_name": log.user.name if log.user else "",
                "created_at": log.created_at,
            }
            for log in logs
        ]
        return Response(data)


@api_view(["GET"])
def checklist(request):
    inspection_id = request.query_params.get("inspection_id")
    version = None
    if inspection_id:
        try:
            inspection = Inspection.objects.get(pk=inspection_id)
            ensure_inspection_owner_or_staff(inspection, request.user)
            version = resolve_checklist_version(inspection)
        except Inspection.DoesNotExist:
            raise Http404("Inspeção não encontrada")
    else:
        version = resolve_checklist_version()

    sections = ChecklistSection.objects.prefetch_related("items").order_by("order")
    if version:
        sections = sections.filter(version=version)
    return Response(ChecklistSectionSerializer(sections, many=True).data)
