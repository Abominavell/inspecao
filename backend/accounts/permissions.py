from rest_framework.permissions import BasePermission

from .models import AppRole, AuthSource


class IsInternalMaster(BasePermission):
    """Somente Super Administrador interno (auth_source=INTERNAL_MASTER)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "auth_source", None) == AuthSource.INTERNAL_MASTER
            and user.is_superuser
            and user.is_active
            and getattr(user, "role", None) == AppRole.SUPER_ADMIN
        )


class IsEntraCollaborator(BasePermission):
    """Usuário autenticado via Microsoft Entra."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "auth_source", None) == AuthSource.ENTRA
            and user.is_active
        )


class IsStaffOrMaster(BasePermission):
    """Admin da aplicação (staff legado/Entra admin) ou master interno."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if getattr(user, "auth_source", None) == AuthSource.INTERNAL_MASTER and user.is_superuser:
            return True
        return bool(user.is_staff)
