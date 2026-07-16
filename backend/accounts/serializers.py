from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import AuthSource
from .tokens import AppRefreshToken

User = get_user_model()


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"
    token_class = AppRefreshToken

    def validate(self, attrs):
        attrs["email"] = attrs.get("email", "").lower()
        data = super().validate(attrs)
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "name",
            "is_staff",
            "is_active",
            "is_superuser",
            "auth_source",
            "role",
            "date_joined",
            "last_authenticated_at",
        )
        read_only_fields = (
            "id",
            "date_joined",
            "auth_source",
            "role",
            "is_superuser",
            "last_authenticated_at",
        )


class UserStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("is_active",)


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("email", "name", "password", "is_staff", "is_active", "role")

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data.pop("email").lower()
        # Usuários criados pela API permanecem LEGACY até migração Entra
        validated_data.setdefault("auth_source", AuthSource.LEGACY)
        return User.objects.create_user(email=email, password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MasterLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class EntraExchangeSerializer(serializers.Serializer):
    access_token = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if getattr(user, "auth_source", None) == AuthSource.ENTRA:
            raise serializers.ValidationError("Usuários Microsoft não possuem senha local")
        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta")
        return value

    def validate(self, attrs):
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "A nova senha deve ser diferente da senha atual"}
            )
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class TokenResponseSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    token_type = serializers.CharField(default="bearer")
