from django.apps import AppConfig


class InspectionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inspections"

    def ready(self):
        from django.db.models.signals import post_migrate

        from accounts.signals import ensure_admin_user

        def _create_admin(sender, **kwargs):
            ensure_admin_user()

        post_migrate.connect(_create_admin, sender=self)
