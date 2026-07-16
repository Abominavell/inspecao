from django.conf import settings
from django.contrib.auth import get_user_model

from .models import AppRole, AuthSource


def ensure_admin_user():
    """Garante Super Administrador interno a partir de ADMIN_EMAIL/PASSWORD."""
    User = get_user_model()
    user = User.objects.filter(email=settings.ADMIN_EMAIL).first()
    if user is None:
        User.objects.create_superuser(
            email=settings.ADMIN_EMAIL,
            password=settings.ADMIN_PASSWORD,
            name=settings.ADMIN_NAME,
            auth_source=AuthSource.INTERNAL_MASTER,
            role=AppRole.SUPER_ADMIN,
        )
        return

    updated_fields: list[str] = []
    if not user.is_staff:
        user.is_staff = True
        updated_fields.append("is_staff")
    if not user.is_superuser:
        user.is_superuser = True
        updated_fields.append("is_superuser")
    if not user.name:
        user.name = settings.ADMIN_NAME
        updated_fields.append("name")
    if user.auth_source != AuthSource.INTERNAL_MASTER:
        user.auth_source = AuthSource.INTERNAL_MASTER
        updated_fields.append("auth_source")
    if user.role != AppRole.SUPER_ADMIN:
        user.role = AppRole.SUPER_ADMIN
        updated_fields.append("role")
    if updated_fields:
        user.save(update_fields=updated_fields)
