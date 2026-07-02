import base64
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from inspections.models import (
    Inspection,
    InspectionAnswer,
    Photo,
    SyncIdempotencyKey,
    Unit,
)
from inspections.serializers import AnswerSerializer, InspectionSerializer
from inspections.services.audit import log_inspection_action
from inspections.services.checklist_version import get_active_checklist_version
from inspections.services.cover import default_cover_fields
from inspections.services.workflow import ensure_inspection_editable, ensure_inspection_owner_or_staff


def _get_idempotency(user, mutation_id: str):
    if not mutation_id:
        return None
    try:
        row = SyncIdempotencyKey.objects.get(mutation_id=mutation_id, user=user)
        return row.response_json
    except SyncIdempotencyKey.DoesNotExist:
        return None


def _save_idempotency(user, mutation_id: str, response_json: dict):
    if not mutation_id:
        return
    SyncIdempotencyKey.objects.update_or_create(
        mutation_id=mutation_id,
        defaults={"user": user, "response_json": response_json},
    )
    cutoff = timezone.now() - timedelta(hours=72)
    SyncIdempotencyKey.objects.filter(created_at__lt=cutoff).delete()


def _resolve_inspection(client_id: str | None, server_id: int | None, user) -> Inspection | None:
    if server_id:
        try:
            insp = Inspection.objects.get(pk=server_id)
            ensure_inspection_owner_or_staff(insp, user)
            return insp
        except Inspection.DoesNotExist:
            return None
    if client_id:
        try:
            insp = Inspection.objects.get(client_id=client_id)
            ensure_inspection_owner_or_staff(insp, user)
            return insp
        except (Inspection.DoesNotExist, ValueError):
            return None
    return None


def _handle_inspection_create(user, payload: dict, mutation_id: str) -> dict:
    cached = _get_idempotency(user, mutation_id)
    if cached:
        return cached

    client_id = payload.get("client_id")
    if not client_id:
        raise ValidationError("client_id obrigatório")

    existing = Inspection.objects.filter(client_id=client_id).first()
    if existing:
        result = {
            "mutation_id": mutation_id,
            "type": "inspection.create",
            "client_id": str(existing.client_id),
            "server_id": existing.id,
        }
        _save_idempotency(user, mutation_id, result)
        return result

    unit_id = payload.get("unit_id")
    if not unit_id:
        raise ValidationError("unit_id obrigatório")

    version = get_active_checklist_version()
    inspection = Inspection.objects.create(
        client_id=client_id,
        unit_id=unit_id,
        created_by=user,
        inspection_date=payload.get("inspection_date"),
        report_date=payload.get("report_date"),
        checklist_version=version,
        **default_cover_fields(),
    )
    log_inspection_action(inspection, user, "created", "Inspeção criada via sync")
    result = {
        "mutation_id": mutation_id,
        "type": "inspection.create",
        "client_id": str(inspection.client_id),
        "server_id": inspection.id,
    }
    _save_idempotency(user, mutation_id, result)
    return result


def _handle_inspection_update(user, payload: dict, mutation_id: str) -> dict:
    cached = _get_idempotency(user, mutation_id)
    if cached:
        return cached

    inspection = _resolve_inspection(
        payload.get("client_id"), payload.get("server_id"), user
    )
    if not inspection:
        raise ValidationError("Inspeção não encontrada")

    ensure_inspection_editable(inspection, user)
    expected = payload.get("expected_updated_at")
    if expected and inspection.updated_at.isoformat() > expected:
        return {
            "mutation_id": mutation_id,
            "type": "inspection.update",
            "conflict": True,
            "client_id": str(inspection.client_id),
            "server_id": inspection.id,
            "server_updated_at": inspection.updated_at.isoformat(),
        }

    fields = dict(payload.get("fields", {}))
    allowed = {
        "methodology_text",
        "objectives_text",
        "limitations_text",
        "final_considerations_text",
        "general_info_text",
        "cover_diretor_executivo",
        "cover_gerente_geral",
        "cover_gerente_sst",
        "cover_gerente_meio_ambiente",
        "inspection_date",
        "report_date",
    }
    for key in allowed:
        if key in payload and key not in fields:
            fields[key] = payload[key]
    for key, value in fields.items():
        if key in allowed:
            setattr(inspection, key, value)
    inspection.save()
    result = {
        "mutation_id": mutation_id,
        "type": "inspection.update",
        "client_id": str(inspection.client_id),
        "server_id": inspection.id,
        "updated_at": inspection.updated_at.isoformat(),
    }
    _save_idempotency(user, mutation_id, result)
    return result


def _handle_unit_update(user, payload: dict, mutation_id: str) -> dict:
    cached = _get_idempotency(user, mutation_id)
    if cached:
        return cached

    unit_id = payload.get("unit_id")
    unit_data = payload.get("unit", {})
    if not unit_id:
        raise ValidationError("unit_id obrigatório")

    try:
        unit = Unit.objects.get(pk=unit_id)
    except Unit.DoesNotExist:
        raise ValidationError("Unidade não encontrada")

    for field in (
        "name",
        "regional",
        "city",
        "address",
        "unit_type",
        "employee_count",
        "admin_coordinator",
        "general_director",
        "characterization",
    ):
        if field in unit_data:
            setattr(unit, field, unit_data[field])
    unit.save()

    inspection = _resolve_inspection(payload.get("client_id"), payload.get("server_id"), user)
    if inspection:
        ensure_inspection_editable(inspection, user)
        if payload.get("unit_id") and inspection.unit_id != unit_id:
            inspection.unit_id = unit_id
            inspection.save(update_fields=["unit_id", "updated_at"])

    result = {"mutation_id": mutation_id, "type": "unit.update", "unit_id": unit.id}
    _save_idempotency(user, mutation_id, result)
    return result


def _handle_answers_upsert(user, payload: dict, mutation_id: str) -> dict:
    cached = _get_idempotency(user, mutation_id)
    if cached:
        return cached

    inspection = _resolve_inspection(payload.get("inspection_client_id"), payload.get("server_id"), user)
    if not inspection:
        raise ValidationError("Inspeção não encontrada")

    ensure_inspection_editable(inspection, user)
    existing = {a.checklist_item_id: a for a in inspection.answers.all()}

    for item in payload.get("answers", []):
        status_val = item.get("status")
        if status_val == InspectionAnswer.AnswerStatus.NC:
            if not item.get("description", "").strip():
                raise ValidationError(f"Descrição obrigatória NC item {item.get('checklist_item_id')}")
            if not item.get("recommendation", "").strip():
                raise ValidationError(f"Recomendação obrigatória NC item {item.get('checklist_item_id')}")

        answer = existing.get(item["checklist_item_id"])
        if answer:
            answer.status = status_val
            answer.description = item.get("description", "")
            answer.recommendation = item.get("recommendation", "")
            answer.normative = item.get("normative", "")
            answer.save()
        else:
            InspectionAnswer.objects.create(
                inspection=inspection,
                checklist_item_id=item["checklist_item_id"],
                status=status_val,
                description=item.get("description", ""),
                recommendation=item.get("recommendation", ""),
                normative=item.get("normative", ""),
            )

    log_inspection_action(inspection, user, "answers_updated", "Sync batch")
    result = {
        "mutation_id": mutation_id,
        "type": "answers.upsert",
        "server_id": inspection.id,
        "client_id": str(inspection.client_id),
    }
    _save_idempotency(user, mutation_id, result)
    return result


def _handle_photo_upload(user, payload: dict, mutation_id: str) -> dict:
    cached = _get_idempotency(user, mutation_id)
    if cached:
        return cached

    client_photo_id = payload.get("client_photo_id")
    if not client_photo_id:
        raise ValidationError("client_photo_id obrigatório")

    existing_photo = Photo.objects.filter(client_id=client_photo_id).first()
    if existing_photo:
        result = {
            "mutation_id": mutation_id,
            "type": "photo.upload",
            "client_photo_id": str(existing_photo.client_id),
            "server_photo_id": existing_photo.id,
            "answer_id": existing_photo.answer_id,
        }
        _save_idempotency(user, mutation_id, result)
        return result

    inspection = _resolve_inspection(payload.get("inspection_client_id"), payload.get("server_id"), user)
    if not inspection:
        raise ValidationError("Inspeção não encontrada")
    ensure_inspection_editable(inspection, user)

    photo_type = payload.get("photo_type", "nc")
    file_b64 = payload.get("file_base64", "")
    if not file_b64:
        raise ValidationError("file_base64 obrigatório")

    file_bytes = base64.b64decode(file_b64)
    from django.core.files.base import ContentFile

    filename = payload.get("original_filename", "photo.jpg")

    if photo_type == "address":
        inspection.address_photo.save(
            f"local_{uuid.uuid4().hex}.jpg",
            ContentFile(file_bytes),
            save=True,
        )
        result = {
            "mutation_id": mutation_id,
            "type": "photo.upload",
            "photo_type": "address",
            "client_photo_id": client_photo_id,
            "server_id": inspection.id,
        }
        _save_idempotency(user, mutation_id, result)
        return result

    checklist_item_id = payload.get("checklist_item_id")
    answer, _ = InspectionAnswer.objects.get_or_create(
        inspection=inspection,
        checklist_item_id=checklist_item_id,
        defaults={"status": InspectionAnswer.AnswerStatus.NC},
    )
    if answer.status != InspectionAnswer.AnswerStatus.NC:
        answer.status = InspectionAnswer.AnswerStatus.NC
        answer.save(update_fields=["status"])

    photo = Photo.objects.create(
        client_id=client_photo_id,
        answer=answer,
        image=ContentFile(file_bytes, name=f"{uuid.uuid4().hex}.jpg"),
        original_filename=filename,
    )
    result = {
        "mutation_id": mutation_id,
        "type": "photo.upload",
        "client_photo_id": str(photo.client_id),
        "server_photo_id": photo.id,
        "answer_id": answer.id,
    }
    _save_idempotency(user, mutation_id, result)
    return result


def _handle_photo_delete(user, payload: dict, mutation_id: str) -> dict:
    cached = _get_idempotency(user, mutation_id)
    if cached:
        return cached

    client_photo_id = payload.get("client_photo_id")
    server_photo_id = payload.get("server_photo_id")
    photo_type = payload.get("photo_type", "nc")

    if photo_type == "address":
        inspection = _resolve_inspection(payload.get("inspection_client_id"), payload.get("server_id"), user)
        if inspection and inspection.address_photo:
            ensure_inspection_editable(inspection, user)
            inspection.address_photo.delete(save=False)
            inspection.address_photo = None
            inspection.save(update_fields=["address_photo", "updated_at"])
    elif server_photo_id:
        try:
            photo = Photo.objects.get(pk=server_photo_id)
            ensure_inspection_editable(photo.answer.inspection, user)
            if photo.image:
                photo.image.delete(save=False)
            photo.delete()
        except Photo.DoesNotExist:
            pass
    elif client_photo_id:
        try:
            photo = Photo.objects.get(client_id=client_photo_id)
            ensure_inspection_editable(photo.answer.inspection, user)
            if photo.image:
                photo.image.delete(save=False)
            photo.delete()
        except Photo.DoesNotExist:
            pass

    result = {"mutation_id": mutation_id, "type": "photo.delete", "ok": True}
    _save_idempotency(user, mutation_id, result)
    return result


HANDLERS = {
    "inspection.create": _handle_inspection_create,
    "inspection.update": _handle_inspection_update,
    "unit.update": _handle_unit_update,
    "answers.upsert": _handle_answers_upsert,
    "photo.upload": _handle_photo_upload,
    "photo.delete": _handle_photo_delete,
}


@api_view(["POST"])
def sync_push(request):
    mutations = request.data.get("mutations", [])
    applied = []
    errors = []
    id_map: dict[str, int] = {}
    conflicts = []

    with transaction.atomic():
        for mut in mutations:
            mutation_id = mut.get("mutation_id", "")
            mut_type = mut.get("type", "")
            payload = mut.get("payload", {})
            handler = HANDLERS.get(mut_type)
            if not handler:
                errors.append({"mutation_id": mutation_id, "error": f"Tipo desconhecido: {mut_type}"})
                continue
            try:
                result = handler(request.user, payload, mutation_id)
                applied.append(result)
                if result.get("conflict"):
                    conflicts.append(result)
                if result.get("client_id") and result.get("server_id"):
                    id_map[str(result["client_id"])] = result["server_id"]
                elif payload.get("client_id") and result.get("server_id"):
                    id_map[str(payload["client_id"])] = result["server_id"]
            except Exception as e:
                errors.append({"mutation_id": mutation_id, "error": str(e)})

    return Response({"applied": applied, "id_map": id_map, "conflicts": conflicts, "errors": errors})


@api_view(["GET"])
def sync_pull(request):
    since = request.data.get("since") or request.query_params.get("since")
    user = request.user
    qs = Inspection.objects.select_related("unit", "created_by").filter(is_archived=False)
    if not user.is_staff:
        qs = qs.filter(created_by=user)
    if since:
        qs = qs.filter(updated_at__gte=since)

    inspections = []
    for insp in qs.order_by("-updated_at")[:100]:
        answers = insp.answers.select_related("checklist_item").prefetch_related("photos")
        inspections.append(
            {
                "inspection": InspectionSerializer(insp).data,
                "answers": AnswerSerializer(
                    answers, many=True, context={"request": request}
                ).data,
                "client_id": str(insp.client_id),
            }
        )

    return Response(
        {
            "inspections": inspections,
            "pulled_at": timezone.now().isoformat(),
        }
    )
