from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import AppRole, AuthSource
from accounts.services.entra import EntraClaims
from accounts.tokens import issue_token_pair

User = get_user_model()


class DualAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.master = User.objects.create_superuser(
            email="master@ssma.com.br",
            password="MasterPass123!",
            name="Master",
            auth_source=AuthSource.INTERNAL_MASTER,
            role=AppRole.SUPER_ADMIN,
        )
        self.legacy = User.objects.create_user(
            email="inspetor@ssma.com.br",
            password="Inspetor123!",
            name="Inspetor",
            auth_source=AuthSource.LEGACY,
            role=AppRole.COLABORADOR,
        )

    def test_refresh_returns_access_token_key(self):
        tokens = issue_token_pair(self.legacy)
        res = self.client.post(
            "/auth/token/refresh",
            {"refresh": tokens["refresh_token"]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.data)
        self.assertNotIn("access", res.data)

    def test_master_login_ok(self):
        res = self.client.post(
            "/auth/master/login",
            {"email": "master@ssma.com.br", "password": "MasterPass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.data)
        self.assertEqual(res.data["user"]["auth_source"], AuthSource.INTERNAL_MASTER)

    def test_master_login_rejects_legacy(self):
        res = self.client.post(
            "/auth/master/login",
            {"email": "inspetor@ssma.com.br", "password": "Inspetor123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(AUTH_ENTRA_ENABLED=True)
    @patch("accounts.views_auth.validate_entra_access_token")
    @patch("accounts.views_auth.upsert_entra_user")
    def test_entra_exchange(self, mock_upsert, mock_validate):
        mock_validate.return_value = EntraClaims(
            oid="oid-1",
            tid="tid-1",
            email="colab@empresa.com",
            name="Colab",
            job_title="Analista",
            department="SSMA",
            roles=["COLABORADOR"],
            raw={"roles": ["COLABORADOR"]},
        )
        entra_user = User.objects.create_user(
            email="colab@empresa.com",
            password=None,
            name="Colab",
            auth_source=AuthSource.ENTRA,
            role=AppRole.COLABORADOR,
        )
        mock_upsert.return_value = entra_user
        res = self.client.post(
            "/auth/entra/exchange",
            {"access_token": "fake.entra.token"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.data)
        self.assertEqual(res.data["user"]["auth_source"], AuthSource.ENTRA)

    @override_settings(AUTH_ENTRA_ENABLED=False)
    def test_entra_disabled(self):
        res = self.client.post(
            "/auth/entra/exchange",
            {"access_token": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @override_settings(AUTH_LEGACY_PASSWORD_LOGIN=False)
    def test_legacy_login_gone(self):
        res = self.client.post(
            "/auth/login/json",
            {"email": "inspetor@ssma.com.br", "password": "Inspetor123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_410_GONE)
