from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0003_simplify_inspection_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="inspection",
            name="address_photo",
            field=models.ImageField(blank=True, null=True, upload_to="inspections/%(id)s/address"),
        ),
    ]
