from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsStaffOrMaster
from .serializers import (
    ChangePasswordSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserStatusSerializer,
)

User = get_user_model()


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Senha alterada com sucesso"})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by("email")
    permission_classes = [IsStaffOrMaster]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("partial_update", "update"):
            return UserStatusSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        raise ValidationError("Use PATCH para ativar ou desativar o usuário.")

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk and request.data.get("is_active") is False:
            raise ValidationError("Você não pode desativar seu próprio usuário")
        super().partial_update(request, *args, **kwargs)
        user.refresh_from_db()
        return Response(UserSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        raise ValidationError(
            "Exclusão não permitida. Desative o usuário para preservar as inspeções vinculadas."
        )
