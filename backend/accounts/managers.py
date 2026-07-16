from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("E-mail obrigatório")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        from .models import AppRole, AuthSource

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("auth_source", AuthSource.INTERNAL_MASTER)
        extra_fields.setdefault("role", AppRole.SUPER_ADMIN)
        if not password:
            raise ValueError("Superusuário precisa de senha")
        return self.create_user(email, password, **extra_fields)
