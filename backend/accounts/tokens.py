from rest_framework_simplejwt.tokens import RefreshToken


class AppRefreshToken(RefreshToken):
    """SimpleJWT com claims de origem e papel da aplicação."""

    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        token["auth_source"] = getattr(user, "auth_source", "LEGACY")
        token["role"] = getattr(user, "role", "COLABORADOR")
        token["email"] = user.email
        if hasattr(user, "entra_identity"):
            identity = user.entra_identity
            token["tid"] = identity.tenant_id
            token["oid"] = identity.object_id
        return token


def issue_token_pair(user) -> dict:
    refresh = AppRefreshToken.for_user(user)
    return {
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
        "token_type": "bearer",
    }
