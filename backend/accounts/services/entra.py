from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from django.conf import settings
from django.utils import timezone
from jwt import PyJWKClient

from accounts.models import AppRole, AuthSource, EntraIdentity, User
from accounts.services.audit import map_entra_roles

logger = logging.getLogger(__name__)


class EntraValidationError(Exception):
    def __init__(self, message: str, code: str = "invalid_token"):
        self.message = message
        self.code = code
        super().__init__(message)


@dataclass
class EntraClaims:
    oid: str
    tid: str
    email: str
    name: str
    job_title: str
    department: str
    roles: list[str]
    raw: dict[str, Any]


@lru_cache(maxsize=16)
def _jwks_client(tenant_id: str) -> PyJWKClient:
    url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    return PyJWKClient(url, cache_keys=True)


def _allowed_tenants() -> set[str]:
    configured = getattr(settings, "AUTH_ENTRA_ALLOWED_TENANTS", "") or ""
    tenants = {t.strip() for t in configured.split(",") if t.strip()}
    default = getattr(settings, "AUTH_ENTRA_TENANT_ID", "") or ""
    if default:
        tenants.add(default)
    return tenants


def _audiences() -> list[str]:
    aud = getattr(settings, "AUTH_ENTRA_API_AUDIENCE", "") or ""
    client_id = getattr(settings, "AUTH_ENTRA_CLIENT_ID", "") or ""
    values = [v.strip() for v in aud.split(",") if v.strip()]
    if client_id and client_id not in values:
        values.append(client_id)
    if client_id and f"api://{client_id}" not in values:
        values.append(f"api://{client_id}")
    return values


def validate_entra_access_token(access_token: str) -> EntraClaims:
    if not access_token or not access_token.strip():
        raise EntraValidationError("Access token ausente")

    try:
        unverified = jwt.decode(access_token, options={"verify_signature": False})
    except jwt.PyJWTError as exc:
        raise EntraValidationError(f"Token malformado: {exc}") from exc

    tid = str(unverified.get("tid") or "").strip()
    if not tid:
        raise EntraValidationError("Claim tid ausente", "missing_tid")
    if tid not in _allowed_tenants():
        raise EntraValidationError("Tenant não autorizado", "tenant_not_allowed")

    audiences = _audiences()
    if not audiences:
        raise EntraValidationError("AUTH_ENTRA_API_AUDIENCE/CLIENT_ID não configurados")

    issuers = [
        f"https://login.microsoftonline.com/{tid}/v2.0",
        f"https://sts.windows.net/{tid}/",
    ]

    try:
        signing_key = _jwks_client(tid).get_signing_key_from_jwt(access_token)
        claims = jwt.decode(
            access_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audiences,
            issuer=issuers,
            options={"require": ["exp", "iat"]},
        )
    except jwt.PyJWTError as exc:
        logger.info("Falha na validação Entra: %s", exc)
        raise EntraValidationError(f"Token Entra inválido: {exc}") from exc

    oid = str(claims.get("oid") or "").strip()
    if not oid:
        raise EntraValidationError("Claim oid ausente", "missing_oid")

    email = (
        claims.get("preferred_username")
        or claims.get("email")
        or claims.get("upn")
        or ""
    )
    email = str(email).strip().lower()
    name = str(claims.get("name") or claims.get("given_name") or email or oid).strip()
    roles = claims.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]

    return EntraClaims(
        oid=oid,
        tid=tid,
        email=email,
        name=name,
        job_title=str(claims.get("jobTitle") or claims.get("job_title") or ""),
        department=str(claims.get("department") or ""),
        roles=[str(r) for r in roles],
        raw=claims,
    )


def upsert_entra_user(claims: EntraClaims) -> User:
    identity = (
        EntraIdentity.objects.select_related("user")
        .filter(tenant_id=claims.tid, object_id=claims.oid)
        .first()
    )
    role = map_entra_roles(claims.raw)
    is_staff = role in {
        AppRole.ADMINISTRADOR,
        AppRole.QUALIDADE,
        AppRole.AUDITOR,
        AppRole.GESTOR,
    }

    if identity:
        user = identity.user
        user.name = claims.name or user.name
        if claims.email and user.email != claims.email:
            # Mantém e-mail único; só atualiza se livre
            if not User.objects.filter(email=claims.email).exclude(pk=user.pk).exists():
                user.email = claims.email
        user.auth_source = AuthSource.ENTRA
        user.role = role
        user.is_staff = is_staff
        user.is_superuser = False
        user.set_unusable_password()
        user.save()
    else:
        email = claims.email or f"{claims.oid}@{claims.tid}.entra.local"
        if User.objects.filter(email=email).exists():
            # Evita colisão: sufixo determinístico
            email = f"{claims.oid}.{claims.tid[:8]}@entra.local"
        user = User.objects.create_user(
            email=email,
            password=None,
            name=claims.name,
            auth_source=AuthSource.ENTRA,
            role=role,
            is_staff=is_staff,
            is_superuser=False,
            is_active=True,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        identity = EntraIdentity(user=user, tenant_id=claims.tid, object_id=claims.oid)

    now = timezone.now()
    identity.display_name = claims.name
    identity.email = claims.email or identity.email
    identity.job_title = claims.job_title
    identity.department = claims.department
    identity.last_claims_sync_at = now
    identity.last_authenticated_at = now
    identity.save()
    user.mark_authenticated()
    return user
