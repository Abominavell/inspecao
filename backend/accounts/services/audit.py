from __future__ import annotations

from typing import Any

from accounts.models import AuthAuditEvent, User


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_auth_event(
    *,
    source: str,
    event: str,
    result: str,
    request=None,
    user: User | None = None,
    tenant_id: str = "",
    object_id: str = "",
    jti: str = "",
    detail: str = "",
) -> AuthAuditEvent:
    ip = None
    ua = ""
    if request is not None:
        ip = client_ip(request)
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]
    return AuthAuditEvent.objects.create(
        source=source,
        event=event,
        result=result,
        user=user,
        tenant_id=tenant_id or "",
        object_id=object_id or "",
        jti=jti or "",
        ip_address=ip,
        user_agent=ua,
        detail=(detail or "")[:512],
    )


def map_entra_roles(claims: dict[str, Any]) -> str:
    """Mapeia app roles / groups do token Entra para papéis internos."""
    from accounts.models import AppRole

    roles = claims.get("roles") or claims.get("groups") or []
    if isinstance(roles, str):
        roles = [roles]
    normalized = {str(r).upper() for r in roles}
    mapping = [
        ("ADMINISTRADOR", AppRole.ADMINISTRADOR),
        ("ADMIN", AppRole.ADMINISTRADOR),
        ("QUALIDADE", AppRole.QUALIDADE),
        ("AUDITOR", AppRole.AUDITOR),
        ("GESTOR", AppRole.GESTOR),
        ("COLABORADOR", AppRole.COLABORADOR),
    ]
    for key, role in mapping:
        if key in normalized:
            return role
    return AppRole.COLABORADOR
