from django.conf import settings
from django.contrib.auth import get_user_model


def ensure_admin_user():
    User = get_user_model()
    user = User.objects.filter(email=settings.ADMIN_EMAIL).first()
    if user is None:
        User.objects.create_superuser(
            email=settings.ADMIN_EMAIL,
            password=settings.ADMIN_PASSWORD,
            name=settings.ADMIN_NAME,
        )
        return

    updated = False
    if not user.is_staff:
        user.is_staff = True
        updated = True
    if not user.is_superuser:
        user.is_superuser = True
        updated = True
    if not user.name:
        user.name = settings.ADMIN_NAME
        updated = True
    if updated:
        user.save(update_fields=["is_staff", "is_superuser", "name"])
