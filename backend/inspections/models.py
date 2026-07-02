import uuid

from django.conf import settings
from django.db import models


class Unit(models.Model):
    name = models.CharField(max_length=255)
    regional = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    address = models.TextField(blank=True, default="")
    unit_type = models.CharField(max_length=255, blank=True, default="")
    employee_count = models.PositiveIntegerField(default=0)
    admin_coordinator = models.CharField(max_length=255, blank=True, default="")
    general_director = models.CharField(max_length=255, blank=True, default="")
    characterization = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ChecklistSection(models.Model):
    version = models.ForeignKey(
        "ChecklistVersion",
        on_delete=models.CASCADE,
        related_name="sections",
        null=True,
        blank=True,
    )
    order = models.PositiveIntegerField()
    title = models.CharField(max_length=500)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        return self.title


class ChecklistVersion(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=255)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.label

    def save(self, *args, **kwargs):
        if self.is_active:
            ChecklistVersion.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class ChecklistItem(models.Model):
    section = models.ForeignKey(ChecklistSection, on_delete=models.CASCADE, related_name="items")
    order = models.PositiveIntegerField()
    item_code = models.CharField(max_length=20)
    question = models.TextField()

    class Meta:
        ordering = ["section__order", "order"]

    def __str__(self) -> str:
        return self.item_code


def inspection_address_photo_upload_to(instance, filename):
    return f"inspections/{instance.id}/address/{filename}"


class Inspection(models.Model):
    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        FINALIZADO = "finalizado", "Finalizado"

    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="inspections")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="inspections")
    inspection_date = models.DateField()
    report_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RASCUNHO)
    is_archived = models.BooleanField(default=False)
    client_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    checklist_version = models.ForeignKey(
        "ChecklistVersion",
        on_delete=models.PROTECT,
        related_name="inspections",
        null=True,
        blank=True,
    )
    methodology_text = models.TextField(blank=True, default="")
    objectives_text = models.TextField(blank=True, default="")
    limitations_text = models.TextField(blank=True, default="")
    final_considerations_text = models.TextField(blank=True, default="")
    general_info_text = models.TextField(blank=True, default="")
    cover_diretoria_executiva = models.CharField(max_length=255, blank=True, default="")
    cover_diretor_executivo = models.CharField(max_length=255, blank=True, default="")
    cover_gerencia_geral = models.CharField(max_length=255, blank=True, default="")
    cover_gerente_geral = models.CharField(max_length=255, blank=True, default="")
    cover_gerencia_sst = models.CharField(max_length=255, blank=True, default="")
    cover_gerente_sst = models.CharField(max_length=255, blank=True, default="")
    cover_gerencia_meio_ambiente = models.CharField(max_length=255, blank=True, default="")
    cover_gerente_meio_ambiente = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    address_photo = models.ImageField(
        upload_to=inspection_address_photo_upload_to,
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Inspeção {self.id} — {self.unit.name}"


class InspectionAuditLog(models.Model):
    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name="audit_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_audit_logs",
    )
    action = models.CharField(max_length=64)
    details = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.inspection_id} — {self.action}"


class InspectionAnswer(models.Model):
    class AnswerStatus(models.TextChoices):
        C = "C", "Conforme"
        NC = "NC", "Não conforme"
        NA = "NA", "Não aplicável"

    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name="answers")
    checklist_item = models.ForeignKey(ChecklistItem, on_delete=models.CASCADE)
    client_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=2, choices=AnswerStatus.choices, blank=True, null=True)
    description = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")
    normative = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("inspection", "checklist_item")

    def __str__(self) -> str:
        return f"{self.inspection_id} — {self.checklist_item.item_code}"


def photo_upload_to(instance, filename):
    return f"inspections/{instance.answer.inspection_id}/{filename}"


class Photo(models.Model):
    answer = models.ForeignKey(InspectionAnswer, on_delete=models.CASCADE, related_name="photos")
    client_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    image = models.ImageField(upload_to=photo_upload_to)
    original_filename = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def file_path(self) -> str:
        return str(self.image.path) if self.image else ""


class SyncIdempotencyKey(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    mutation_id = models.CharField(max_length=64, unique=True)
    response_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
