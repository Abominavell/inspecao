from django.contrib import admin
from django.urls import include, path

from inspections.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health),
    path("auth/", include("accounts.urls")),
    path("", include("inspections.urls")),
]
