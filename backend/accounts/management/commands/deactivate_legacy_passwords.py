from django.core.management.base import BaseCommand

from accounts.models import AuthSource, User


class Command(BaseCommand):
    help = (
        "Remove senhas usáveis de usuários LEGACY não-master "
        "(preparação para login exclusivo via Microsoft Entra)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas lista usuários que seriam afetados",
        )
        parser.add_argument(
            "--include-inactive",
            action="store_true",
            help="Também processa usuários inativos",
        )

    def handle(self, *args, **options):
        qs = User.objects.filter(auth_source=AuthSource.LEGACY).exclude(
            is_superuser=True,
        )
        if not options["include_inactive"]:
            qs = qs.filter(is_active=True)

        count = 0
        for user in qs.iterator():
            if not user.has_usable_password():
                continue
            count += 1
            if options["dry_run"]:
                self.stdout.write(f"[dry-run] {user.email}")
                continue
            user.set_unusable_password()
            user.save(update_fields=["password"])
            self.stdout.write(f"Senha desativada: {user.email}")

        action = "seriam afetados" if options["dry_run"] else "atualizados"
        self.stdout.write(self.style.SUCCESS(f"{count} usuário(s) {action}."))
