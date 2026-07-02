from inspections.models import ChecklistItem, ChecklistSection, Inspection, InspectionAnswer


COVER_FIELDS = {
    "diretoria executiva (capa)": "cover_diretoria_executiva",
    "diretor executivo (capa)": "cover_diretor_executivo",
    "gerência geral (capa)": "cover_gerencia_geral",
    "gerente geral (capa)": "cover_gerente_geral",
    "gerência SST (capa)": "cover_gerencia_sst",
    "gerente SST (capa)": "cover_gerente_sst",
    "gerência de meio ambiente (capa)": "cover_gerencia_meio_ambiente",
    "gerente de meio ambiente (capa)": "cover_gerente_meio_ambiente",
}


def _sections_for_inspection(inspection: Inspection):
    qs = ChecklistSection.objects.prefetch_related("items").order_by("order")
    if inspection.checklist_version_id:
        return qs.filter(version_id=inspection.checklist_version_id)
    return qs


def _answers_by_item(inspection: Inspection) -> dict[int, InspectionAnswer]:
    return {
        a.checklist_item_id: a
        for a in inspection.answers.prefetch_related("photos").all()
    }


def get_pending_items(inspection: Inspection) -> list[str]:
    pending: list[str] = []
    answers_by_item = _answers_by_item(inspection)

    for section in _sections_for_inspection(inspection):
        for item in section.items.all():
            answer = answers_by_item.get(item.id)
            if not answer or not answer.status:
                pending.append(f"Responder item {item.item_code}")
                continue
            if answer.status == InspectionAnswer.AnswerStatus.NC:
                if not answer.description.strip():
                    pending.append(f"Descrição no item NC {item.item_code}")
                if not answer.recommendation.strip():
                    pending.append(f"Recomendação no item NC {item.item_code}")
                if not answer.photos.exists():
                    pending.append(f"Foto no item NC {item.item_code}")

    unit = inspection.unit
    unit_checks = {
        "nome da unidade": unit.name,
        "regional": unit.regional,
        "cidade": unit.city,
        "endereço": unit.address,
        "porte da unidade": unit.unit_type,
        "coordenador(a) administrativo": unit.admin_coordinator,
        "diretor geral": unit.general_director,
        "caracterização da unidade": unit.characterization,
    }
    for label, value in unit_checks.items():
        if not str(value).strip():
            pending.append(f"Unidade: {label}")
    if unit.employee_count <= 0:
        pending.append("Unidade: quantidade de funcionários")

    if not inspection.address_photo:
        pending.append("Foto do local (endereço)")

    for label, field in COVER_FIELDS.items():
        if not str(getattr(inspection, field, "")).strip():
            pending.append(f"Capa: {label}")

    text_checks = {
        "informações gerais da unidade": inspection.general_info_text,
        "metodologia": inspection.methodology_text,
        "objetivos do levantamento": inspection.objectives_text,
        "limitações do relatório": inspection.limitations_text,
        "considerações finais": inspection.final_considerations_text,
    }
    for label, value in text_checks.items():
        if not str(value).strip():
            pending.append(f"Relatório: {label}")

    return pending


def validate_inspection_for_report(inspection: Inspection) -> list[str]:
    pending = get_pending_items(inspection)
    errors: list[str] = []
    unanswered = 0
    answers_by_item = _answers_by_item(inspection)
    all_items = 0

    for section in _sections_for_inspection(inspection):
        for item in section.items.all():
            all_items += 1
            answer = answers_by_item.get(item.id)
            if not answer or not answer.status:
                unanswered += 1
                if unanswered <= 5:
                    errors.append(f"Checklist: responda item {item.item_code}")
                continue
            if answer.status == InspectionAnswer.AnswerStatus.NC:
                if not answer.description.strip():
                    errors.append(f"Checklist: descrição obrigatória no item NC {item.item_code}")
                if not answer.recommendation.strip():
                    errors.append(f"Checklist: recomendação obrigatória no item NC {item.item_code}")
                if not answer.photos.exists():
                    errors.append(f"Checklist: foto obrigatória no item NC {item.item_code}")

    if unanswered > 5:
        errors.append(f"Checklist: faltam {unanswered} de {all_items} itens sem resposta")

    unit = inspection.unit
    unit_required = {
        "nome da unidade": unit.name,
        "regional": unit.regional,
        "cidade": unit.city,
        "endereço": unit.address,
        "porte da unidade": unit.unit_type,
        "coordenador(a) administrativo": unit.admin_coordinator,
        "diretor geral": unit.general_director,
        "caracterização da unidade": unit.characterization,
    }
    for label, value in unit_required.items():
        if not str(value).strip():
            errors.append(f"Unidade: preencha {label}")

    if unit.employee_count <= 0:
        errors.append("Unidade: informe a quantidade de funcionários")

    if not inspection.address_photo:
        errors.append("Dados: envie a foto do local (endereço)")

    for label, field in COVER_FIELDS.items():
        if not str(getattr(inspection, field, "")).strip():
            errors.append(f"Capa do relatório: preencha {label}")

    text_required = {
        "informações gerais da unidade": inspection.general_info_text,
        "metodologia": inspection.methodology_text,
        "objetivos do levantamento": inspection.objectives_text,
        "limitações do relatório": inspection.limitations_text,
        "considerações finais": inspection.final_considerations_text,
    }
    for label, value in text_required.items():
        if not str(value).strip():
            errors.append(f"Relatório: preencha {label}")

    return errors


def inspection_progress(inspection: Inspection) -> dict:
    sections = _sections_for_inspection(inspection)
    answers_by_item = _answers_by_item(inspection)
    total_items = 0
    answered = 0
    nc_without_photo = 0

    for section in sections:
        for item in section.items.all():
            total_items += 1
            answer = answers_by_item.get(item.id)
            if answer and answer.status:
                answered += 1
                if answer.status == InspectionAnswer.AnswerStatus.NC and not answer.photos.exists():
                    nc_without_photo += 1

    unit = inspection.unit
    unit_fields = [
        unit.name,
        unit.regional,
        unit.city,
        unit.address,
        unit.unit_type,
        unit.admin_coordinator,
        unit.general_director,
        unit.characterization,
    ]
    unit_complete = all(str(f).strip() for f in unit_fields) and unit.employee_count > 0
    address_photo_complete = bool(inspection.address_photo)

    cover_complete = all(
        str(getattr(inspection, field, "")).strip() for field in COVER_FIELDS.values()
    )

    texts_complete = all(
        str(t).strip()
        for t in [
            inspection.methodology_text,
            inspection.objectives_text,
            inspection.limitations_text,
            inspection.final_considerations_text,
            inspection.general_info_text,
        ]
    )

    checklist_complete = answered == total_items and total_items > 0 and nc_without_photo == 0
    pending_items = get_pending_items(inspection)
    ready_for_report = (
        unit_complete
        and address_photo_complete
        and cover_complete
        and texts_complete
        and checklist_complete
    )

    return {
        "unit_complete": unit_complete,
        "address_photo_complete": address_photo_complete,
        "cover_complete": cover_complete,
        "texts_complete": texts_complete,
        "checklist_answered": answered,
        "checklist_total": total_items,
        "checklist_complete": checklist_complete,
        "nc_without_photo": nc_without_photo,
        "ready_for_report": ready_for_report,
        "pending_items": pending_items[:30],
        "pending_count": len(pending_items),
    }
