from rest_framework.exceptions import PermissionDenied, ValidationError

from inspections.models import Inspection


def ensure_inspection_editable(inspection: Inspection, user) -> None:
    if inspection.is_archived:
        raise ValidationError("Inspeção arquivada não pode ser editada")

    if inspection.status == Inspection.Status.FINALIZADO:
        if user.is_staff:
            raise ValidationError(
                "Inspeção finalizada. Use a ação de reabertura antes de editar."
            )
        raise ValidationError("Inspeção finalizada não pode ser editada")


def ensure_inspection_owner_or_staff(inspection: Inspection, user) -> None:
    if user.is_staff:
        return
    if inspection.created_by_id != user.id:
        raise PermissionDenied("Sem permissão para acessar esta inspeção")
