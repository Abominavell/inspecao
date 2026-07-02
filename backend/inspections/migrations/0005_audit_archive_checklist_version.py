import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def assign_default_version(apps, schema_editor):
    ChecklistVersion = apps.get_model("inspections", "ChecklistVersion")
    ChecklistSection = apps.get_model("inspections", "ChecklistSection")
    Inspection = apps.get_model("inspections", "Inspection")

    if not ChecklistSection.objects.exists():
        return

    version, _ = ChecklistVersion.objects.get_or_create(
        slug="legacy",
        defaults={"label": "Anexo IV — legado", "is_active": True},
    )
    ChecklistSection.objects.filter(version__isnull=True).update(version=version)
    Inspection.objects.filter(checklist_version__isnull=True).update(checklist_version=version)


class Migration(migrations.Migration):
    dependencies = [
        ("inspections", "0004_inspection_address_photo"),
    ]

    operations = [
        migrations.CreateModel(
            name="ChecklistVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=64, unique=True)),
                ("label", models.CharField(max_length=255)),
                ("is_active", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="checklistsection",
            name="version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sections",
                to="inspections.checklistversion",
            ),
        ),
        migrations.AddField(
            model_name="inspection",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="inspection",
            name="checklist_version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="inspections",
                to="inspections.checklistversion",
            ),
        ),
        migrations.CreateModel(
            name="InspectionAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=64)),
                ("details", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "inspection",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="audit_logs",
                        to="inspections.inspection",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inspection_audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(assign_default_version, migrations.RunPython.noop),
    ]
