from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ChangePasswordView, MeView, UserViewSet
from .views_auth import (
    CompatibleTokenRefreshView,
    EntraExchangeView,
    LoginJSONView,
    MasterLoginView,
    MasterLogoutView,
    MasterTokenRefreshView,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("login/json", LoginJSONView.as_view(), name="login-json"),
    path("token/refresh", CompatibleTokenRefreshView.as_view(), name="token-refresh"),
    path("entra/exchange", EntraExchangeView.as_view(), name="entra-exchange"),
    path("master/login", MasterLoginView.as_view(), name="master-login"),
    path("master/token/refresh", MasterTokenRefreshView.as_view(), name="master-token-refresh"),
    path("master/logout", MasterLogoutView.as_view(), name="master-logout"),
    path("me", MeView.as_view(), name="me"),
    path("me/change-password", ChangePasswordView.as_view(), name="change-password"),
    path("", include(router.urls)),
]
