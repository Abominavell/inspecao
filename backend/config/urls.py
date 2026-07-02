import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from inspections.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health),
    path("auth/", include("accounts.urls")),
    path("", include("inspections.urls")),
]

if settings.DEBUG or os.getenv("SERVE_MEDIA", "false").lower() in ("1", "true", "yes"):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
