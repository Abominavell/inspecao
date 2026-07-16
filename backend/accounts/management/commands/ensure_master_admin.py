from django.conf import settings
from django.core.management.base import BaseCommand

from accounts.models import AppRole, AuthSource, User


class Command(BaseCommand):
    help = "Cria ou promove o Super Administrador interno (INTERNAL_MASTER)."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=settings.ADMIN_EMAIL)
        parser.add_argument("--password", default=None, help="Se omitido, usa ADMIN_PASSWORD")
        parser.add_argument("--name", default=settings.ADMIN_NAME)
        parser.add_argument(
            "--rotate-password",
            action="store_true",
            help="Atualiza a senha mesmo se o usuário já existir",
        )

    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        password = options["password"] or settings.ADMIN_PASSWORD
        name = options["name"]
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_superuser(
                email=email,
                password=password,
                name=name,
                auth_source=AuthSource.INTERNAL_MASTER,
                role=AppRole.SUPER_ADMIN,
            )
            self.stdout.write(self.style.SUCCESS(f"Master criado: {user.email}"))
            return

        user.name = name or user.name
        user.auth_source = AuthSource.INTERNAL_MASTER
        user.role = AppRole.SUPER_ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        if options["rotate_password"]:
            user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Master atualizado: {user.email}"))
