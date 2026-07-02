from django.apps import AppConfig


class InspectionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inspections"

    def ready(self):
        from django.db.models.signals import post_migrate

        from accounts.signals import ensure_admin_user
        from inspections.services.checklist_seed import ensure_default_checklist

        def _bootstrap(sender, **kwargs):
            ensure_admin_user()
            ensure_default_checklist()

        post_migrate.connect(_bootstrap, sender=self)
