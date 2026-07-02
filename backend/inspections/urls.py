from django.urls import include, path
from rest_framework.routers import DefaultRouter

from inspections.views import InspectionViewSet, UnitViewSet, checklist, ssma_config
from inspections.sync_views import sync_pull, sync_push

router = DefaultRouter(trailing_slash=False)
router.register("units", UnitViewSet, basename="unit")
router.register("inspections", InspectionViewSet, basename="inspection")

urlpatterns = [
    path("checklist", checklist, name="checklist"),
    path("config/ssma", ssma_config, name="ssma-config"),
    path("sync/push", sync_push, name="sync-push"),
    path("sync/pull", sync_pull, name="sync-pull"),
    path("", include(router.urls)),
]
