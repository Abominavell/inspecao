from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsStaffOrInspectionOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return getattr(obj, "created_by_id", None) == request.user.id
