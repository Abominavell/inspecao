from inspections.models import ChecklistVersion


def get_active_checklist_version() -> ChecklistVersion | None:
    return ChecklistVersion.objects.filter(is_active=True).order_by("-created_at").first()


def resolve_checklist_version(inspection=None) -> ChecklistVersion | None:
    if inspection and inspection.checklist_version_id:
        return inspection.checklist_version
    return get_active_checklist_version()
