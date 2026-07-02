from inspections.models import ChecklistItem, ChecklistSection, Inspection, InspectionAnswer


def compute_section_scores(inspection: Inspection) -> dict:
    sections = ChecklistSection.objects.prefetch_related("items").order_by("order")
    if inspection.checklist_version_id:
        sections = sections.filter(version_id=inspection.checklist_version_id)
    answers_by_item = {a.checklist_item_id: a for a in inspection.answers.select_related("checklist_item")}

    section_scores = []
    total_c = total_nc = total_na = 0

    for section in sections:
        c = nc = na = 0
        for item in section.items.all():
            answer = answers_by_item.get(item.id)
            if not answer or not answer.status:
                continue
            if answer.status == InspectionAnswer.AnswerStatus.C:
                c += 1
            elif answer.status == InspectionAnswer.AnswerStatus.NC:
                nc += 1
            elif answer.status == InspectionAnswer.AnswerStatus.NA:
                na += 1

        applicable = c + nc + na
        score = c / applicable if applicable > 0 else None
        total_c += c
        total_nc += nc
        total_na += na

        section_scores.append(
            {
                "section_id": section.id,
                "section_order": section.order,
                "section_title": section.title,
                "conforme": c,
                "nao_conforme": nc,
                "nao_aplicavel": na,
                "total_applicable": applicable,
                "score": score,
            }
        )

    overall_applicable = total_c + total_nc + total_na
    overall_score = total_c / overall_applicable if overall_applicable > 0 else None

    return {
        "sections": section_scores,
        "overall_conforme": total_c,
        "overall_nao_conforme": total_nc,
        "overall_nao_aplicavel": total_na,
        "overall_score": overall_score,
    }


def get_non_conformities(inspection: Inspection) -> list[dict]:
    nc_items = []
    answers = inspection.answers.select_related("checklist_item__section").prefetch_related("photos")
    for answer in answers:
        if answer.status != InspectionAnswer.AnswerStatus.NC:
            continue
        item = answer.checklist_item
        nc_items.append(
            {
                "item_code": item.item_code,
                "question": item.question,
                "description": answer.description or item.question,
                "normative": answer.normative,
                "recommendation": answer.recommendation,
                "section_title": item.section.title,
                "photos": [p.image.path for p in answer.photos.all() if p.image],
            }
        )
    nc_items.sort(key=lambda x: [int(p) if p.isdigit() else p for p in x["item_code"].replace(".", " ").split()])
    return nc_items


def get_checklist_summary(inspection: Inspection) -> list[dict]:
    """Seções do checklist com todos os itens que receberam resposta (C, NC ou NA)."""
    sections = ChecklistSection.objects.prefetch_related("items").order_by("order")
    if inspection.checklist_version_id:
        sections = sections.filter(version_id=inspection.checklist_version_id)

    answers_by_item = {a.checklist_item_id: a for a in inspection.answers.select_related("checklist_item")}

    status_labels = {
        InspectionAnswer.AnswerStatus.C: "Conforme (C)",
        InspectionAnswer.AnswerStatus.NC: "Não conforme (NC)",
        InspectionAnswer.AnswerStatus.NA: "Não aplicável (NA)",
    }

    summary = []
    for section in sections:
        items = []
        for item in section.items.all():
            answer = answers_by_item.get(item.id)
            if not answer or not answer.status:
                continue
            items.append(
                {
                    "item_code": item.item_code,
                    "question": item.question,
                    "status": answer.status,
                    "status_label": status_labels.get(answer.status, answer.status),
                    "description": answer.description or "",
                }
            )
        if items:
            summary.append(
                {
                    "section_order": section.order,
                    "section_title": section.title,
                    "checklist_items": items,
                }
            )
    return summary
