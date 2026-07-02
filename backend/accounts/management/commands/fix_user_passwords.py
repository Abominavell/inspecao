from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Re-hash senhas salvas em texto puro (corrige usuários criados antes do UserAdmin)"

    def handle(self, *args, **options):
        User = get_user_model()
        fixed = 0
        for user in User.objects.all():
            if not user.password or user.password.startswith("pbkdf2_"):
                continue
            plain = user.password
            user.set_password(plain)
            user.save(update_fields=["password"])
            fixed += 1
            self.stdout.write(self.style.WARNING(f"Senha corrigida: {user.email}"))

        if fixed:
            self.stdout.write(self.style.SUCCESS(f"{fixed} usuário(s) corrigido(s)."))
        else:
            self.stdout.write("Nenhuma senha em texto puro encontrada.")
