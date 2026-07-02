import uuid

from django.conf import settings
from django.db import migrations, models


def populate_client_ids(apps, schema_editor):
    Inspection = apps.get_model("inspections", "Inspection")
    InspectionAnswer = apps.get_model("inspections", "InspectionAnswer")
    Photo = apps.get_model("inspections", "Photo")

    for row in Inspection.objects.all():
        row.client_id = uuid.uuid4()
        row.save(update_fields=["client_id"])

    for row in InspectionAnswer.objects.all():
        row.client_id = uuid.uuid4()
        row.save(update_fields=["client_id"])

    for row in Photo.objects.all():
        row.client_id = uuid.uuid4()
        row.save(update_fields=["client_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("inspections", "0005_audit_archive_checklist_version"),
    ]

    operations = [
        migrations.AddField(
            model_name="inspection",
            name="client_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="inspectionanswer",
            name="client_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="inspectionanswer",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="photo",
            name="client_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="photo",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.RunPython(populate_client_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="inspection",
            name="client_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="inspectionanswer",
            name="client_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="inspectionanswer",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name="photo",
            name="client_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="photo",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.CreateModel(
            name="SyncIdempotencyKey",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mutation_id", models.CharField(max_length=64, unique=True)),
                ("response_json", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
