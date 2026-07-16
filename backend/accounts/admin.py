from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuthAuditEvent, EntraIdentity, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "name",
        "auth_source",
        "role",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_filter = ("auth_source", "role", "is_staff", "is_active")
    search_fields = ("email", "name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Perfil", {"fields": ("name", "auth_source", "role")}),
        (
            "Permissões",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Datas", {"fields": ("last_login", "last_authenticated_at", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "name",
                    "password1",
                    "password2",
                    "auth_source",
                    "role",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )
    readonly_fields = ("last_authenticated_at",)


@admin.register(EntraIdentity)
class EntraIdentityAdmin(admin.ModelAdmin):
    list_display = ("email", "tenant_id", "object_id", "user", "last_authenticated_at")
    search_fields = ("email", "object_id", "tenant_id", "display_name")
    raw_id_fields = ("user",)


@admin.register(AuthAuditEvent)
class AuthAuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "source", "event", "result", "user", "ip_address")
    list_filter = ("source", "event", "result")
    search_fields = ("detail", "object_id", "tenant_id", "jti")
    readonly_fields = [f.name for f in AuthAuditEvent._meta.fields]
