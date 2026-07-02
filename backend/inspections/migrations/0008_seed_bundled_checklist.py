import json
from pathlib import Path

from django.db import migrations


def seed_bundled_checklist(apps, schema_editor):
    ChecklistVersion = apps.get_model("inspections", "ChecklistVersion")
    ChecklistSection = apps.get_model("inspections", "ChecklistSection")
    ChecklistItem = apps.get_model("inspections", "ChecklistItem")

    if ChecklistVersion.objects.exists():
        return

    data_path = Path(__file__).resolve().parent.parent / "data" / "checklist_anexo_iv.json"
    sections = json.loads(data_path.read_text(encoding="utf-8"))["sections"]

    version = ChecklistVersion.objects.create(
        slug="anexo-iv",
        label="Anexo IV — diagnóstico SST",
        is_active=True,
    )

    for sec in sections:
        section = ChecklistSection.objects.create(
            version=version,
            order=sec["order"],
            title=sec["title"],
        )
        for item_data in sec["items"]:
            ChecklistItem.objects.create(
                section=section,
                order=item_data["order"],
                item_code=item_data["item_code"],
                question=item_data["question"],
            )


class Migration(migrations.Migration):
    dependencies = [
        ("inspections", "0007_alter_inspection_address_photo"),
    ]

    operations = [
        migrations.RunPython(seed_bundled_checklist, migrations.RunPython.noop),
    ]
