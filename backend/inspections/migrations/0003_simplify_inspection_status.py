from django.db import migrations, models


def migrate_statuses(apps, schema_editor):
    Inspection = apps.get_model("inspections", "Inspection")
    Inspection.objects.filter(status__in=("em_preenchimento", "revisao")).update(status="rascunho")
    Inspection.objects.filter(status="finalizada").update(status="finalizado")


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0002_inspection_cover_fields"),
    ]

    operations = [
        migrations.RunPython(migrate_statuses, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="inspection",
            name="status",
            field=models.CharField(
                choices=[("rascunho", "Rascunho"), ("finalizado", "Finalizado")],
                default="rascunho",
                max_length=20,
            ),
        ),
    ]
