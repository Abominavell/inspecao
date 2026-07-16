from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import AppRole, AuthSource
from .serializers import (
    EntraExchangeSerializer,
    LoginSerializer,
    MasterLoginSerializer,
    UserSerializer,
)
from .services.audit import log_auth_event
from .services.entra import EntraValidationError, upsert_entra_user, validate_entra_access_token
from .tokens import AppRefreshToken, issue_token_pair

User = get_user_model()


class CompatibleTokenRefreshView(TokenRefreshView):
    """Alinha contrato do refresh com o frontend (access_token / refresh_token)."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code != 200:
            return response
        data = dict(response.data)
        access = data.pop("access", None)
        refresh = data.pop("refresh", None)
        payload = {
            "access_token": access,
            "token_type": "bearer",
        }
        if refresh:
            payload["refresh_token"] = refresh
        return Response(payload, status=response.status_code)


class LoginJSONView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not getattr(settings, "AUTH_LEGACY_PASSWORD_LOGIN", True):
            log_auth_event(
                source="LEGACY",
                event="login",
                result="FAILURE",
                request=request,
                detail="Legacy password login disabled",
            )
            return Response(
                {"detail": "Login por e-mail/senha desabilitado. Use Microsoft ou /admin-master."},
                status=status.HTTP_410_GONE,
            )

        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)
        if user is None or not user.is_active:
            log_auth_event(
                source="LEGACY",
                event="login",
                result="FAILURE",
                request=request,
                detail=f"Invalid credentials for {email}",
            )
            return Response({"detail": "Credenciais inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

        # Em modo restrito, legado só para master
        if getattr(settings, "AUTH_LEGACY_LOGIN_MASTER_ONLY", False):
            if user.auth_source != AuthSource.INTERNAL_MASTER and not (
                user.is_superuser and user.auth_source in (AuthSource.LEGACY, AuthSource.INTERNAL_MASTER)
            ):
                log_auth_event(
                    source="LEGACY",
                    event="login",
                    result="FAILURE",
                    request=request,
                    user=user,
                    detail="Legacy login restricted to master",
                )
                return Response(
                    {"detail": "Colaboradores devem entrar com Microsoft."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        user.mark_authenticated()
        tokens = issue_token_pair(user)
        log_auth_event(
            source="LEGACY",
            event="login",
            result="SUCCESS",
            request=request,
            user=user,
        )
        return Response(tokens)


class EntraExchangeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not getattr(settings, "AUTH_ENTRA_ENABLED", False):
            return Response(
                {"detail": "Autenticação Microsoft Entra desabilitada"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = EntraExchangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        access_token = serializer.validated_data["access_token"]

        try:
            claims = validate_entra_access_token(access_token)
            user = upsert_entra_user(claims)
        except EntraValidationError as exc:
            log_auth_event(
                source="ENTRA",
                event="exchange",
                result="FAILURE",
                request=request,
                detail=exc.message,
            )
            return Response(
                {"detail": exc.message, "code": exc.code},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.auth_source == AuthSource.INTERNAL_MASTER:
            log_auth_event(
                source="ENTRA",
                event="exchange",
                result="FAILURE",
                request=request,
                user=user,
                tenant_id=claims.tid,
                object_id=claims.oid,
                detail="Master cannot use Entra exchange",
            )
            return Response(
                {"detail": "Conta master não pode autenticar via Microsoft"},
                status=status.HTTP_403_FORBIDDEN,
            )

        tokens = issue_token_pair(user)
        log_auth_event(
            source="ENTRA",
            event="exchange",
            result="SUCCESS",
            request=request,
            user=user,
            tenant_id=claims.tid,
            object_id=claims.oid,
        )
        return Response(
            {
                **tokens,
                "user": UserSerializer(user).data,
            }
        )


class MasterLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not getattr(settings, "AUTH_MASTER_ENABLED", True):
            return Response(
                {"detail": "Login master desabilitado"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = MasterLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)

        if (
            user is None
            or not user.is_active
            or user.auth_source != AuthSource.INTERNAL_MASTER
            or not user.is_superuser
            or user.role != AppRole.SUPER_ADMIN
        ):
            log_auth_event(
                source="MASTER",
                event="login",
                result="FAILURE",
                request=request,
                detail=f"Master login denied for {email}",
            )
            return Response({"detail": "Credenciais inválidas"}, status=status.HTTP_401_UNAUTHORIZED)

        user.mark_authenticated()
        tokens = issue_token_pair(user)
        log_auth_event(
            source="MASTER",
            event="login",
            result="SUCCESS",
            request=request,
            user=user,
        )
        return Response({**tokens, "user": UserSerializer(user).data})


class MasterLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh") or request.data.get("refresh_token")
        if not refresh:
            return Response({"detail": "refresh_token obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh)
            if getattr(settings, "SIMPLE_JWT", {}).get("BLACKLIST_AFTER_ROTATION") or True:
                try:
                    token.blacklist()
                except AttributeError:
                    # blacklist app não instalado
                    pass
        except TokenError:
            return Response({"detail": "Refresh token inválido"}, status=status.HTTP_400_BAD_REQUEST)

        log_auth_event(
            source="MASTER",
            event="logout",
            result="SUCCESS",
            request=request,
            user=request.user,
        )
        return Response({"detail": "Sessão encerrada"})


class MasterTokenRefreshView(CompatibleTokenRefreshView):
    def post(self, request, *args, **kwargs):
        if not getattr(settings, "AUTH_MASTER_ENABLED", True):
            return Response(
                {"detail": "Login master desabilitado"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return super().post(request, *args, **kwargs)
