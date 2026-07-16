from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from .managers import UserManager


class AuthSource(models.TextChoices):
    LEGACY = "LEGACY", "Legacy"
    ENTRA = "ENTRA", "Microsoft Entra"
    INTERNAL_MASTER = "INTERNAL_MASTER", "Internal Master"


class AppRole(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Administrador"
    ADMINISTRADOR = "ADMINISTRADOR", "Administrador"
    QUALIDADE = "QUALIDADE", "Qualidade"
    AUDITOR = "AUDITOR", "Auditor"
    GESTOR = "GESTOR", "Gestor"
    COLABORADOR = "COLABORADOR", "Colaborador"


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True, default="")
    auth_source = models.CharField(
        max_length=32,
        choices=AuthSource.choices,
        default=AuthSource.LEGACY,
        db_index=True,
    )
    role = models.CharField(
        max_length=32,
        choices=AppRole.choices,
        default=AppRole.COLABORADOR,
        db_index=True,
    )
    last_authenticated_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return self.email

    def mark_authenticated(self) -> None:
        self.last_authenticated_at = timezone.now()
        self.last_login = self.last_authenticated_at
        self.save(update_fields=["last_authenticated_at", "last_login"])

    @property
    def is_internal_master(self) -> bool:
        return (
            self.auth_source == AuthSource.INTERNAL_MASTER
            and self.is_superuser
            and self.is_active
        )

    @property
    def is_entra_user(self) -> bool:
        return self.auth_source == AuthSource.ENTRA and self.is_active


class EntraIdentity(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="entra_identity",
    )
    tenant_id = models.CharField(max_length=64, db_index=True)
    object_id = models.CharField(max_length=64, db_index=True)
    display_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    job_title = models.CharField(max_length=255, blank=True, default="")
    department = models.CharField(max_length=255, blank=True, default="")
    photo_url = models.URLField(blank=True, default="")
    last_claims_sync_at = models.DateTimeField(null=True, blank=True)
    last_authenticated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "object_id"],
                name="uniq_entra_tenant_object",
            ),
        ]
        verbose_name = "Identidade Entra"
        verbose_name_plural = "Identidades Entra"

    def __str__(self) -> str:
        return f"{self.email or self.object_id} ({self.tenant_id})"


class AuthAuditEvent(models.Model):
    class Source(models.TextChoices):
        ENTRA = "ENTRA", "Entra"
        MASTER = "MASTER", "Master"
        LEGACY = "LEGACY", "Legacy"

    class Result(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        FAILURE = "FAILURE", "Failure"

    source = models.CharField(max_length=16, choices=Source.choices)
    event = models.CharField(max_length=64)
    result = models.CharField(max_length=16, choices=Result.choices)
    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="auth_audit_events",
    )
    tenant_id = models.CharField(max_length=64, blank=True, default="")
    object_id = models.CharField(max_length=64, blank=True, default="")
    jti = models.CharField(max_length=128, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    detail = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Evento de auditoria de autenticação"
        verbose_name_plural = "Eventos de auditoria de autenticação"

    def __str__(self) -> str:
        return f"{self.source}:{self.event}:{self.result}"
