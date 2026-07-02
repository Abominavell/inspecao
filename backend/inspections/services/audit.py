from inspections.models import InspectionAuditLog


def log_inspection_action(
    inspection,
    user,
    action: str,
    details: str = "",
) -> None:
    InspectionAuditLog.objects.create(
        inspection=inspection,
        user=user if user and user.is_authenticated else None,
        action=action,
        details=details[:2000],
    )
