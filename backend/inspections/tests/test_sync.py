import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from inspections.models import ChecklistVersion, Inspection, Unit

User = get_user_model()


class SyncApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="inspector@test.com",
            password="testpass123",
            name="Inspector",
        )
        self.other = User.objects.create_user(
            email="other@test.com",
            password="testpass123",
            name="Other",
        )
        self.unit = Unit.objects.create(name="Unidade Teste", regional="Norte", city="Belém")
        ChecklistVersion.objects.create(slug="v1", label="V1", is_active=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _push(self, mutations):
        return self.client.post("/sync/push", {"mutations": mutations}, format="json")

    def test_push_inspection_create_idempotent(self):
        client_id = str(uuid.uuid4())
        mutation_id = str(uuid.uuid4())
        body = {
            "mutation_id": mutation_id,
            "type": "inspection.create",
            "payload": {
                "client_id": client_id,
                "unit_id": self.unit.id,
                "inspection_date": "2026-07-01",
                "report_date": "2026-07-01",
            },
        }
        r1 = self._push([body])
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(Inspection.objects.filter(client_id=client_id).count(), 1)
        server_id = r1.data["id_map"][client_id]

        r2 = self._push([body])
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(Inspection.objects.filter(client_id=client_id).count(), 1)
        self.assertEqual(r2.data["applied"][0]["server_id"], server_id)

    def test_push_inspection_update_conflict(self):
        client_id = str(uuid.uuid4())
        create = self._push(
            [
                {
                    "mutation_id": str(uuid.uuid4()),
                    "type": "inspection.create",
                    "payload": {
                        "client_id": client_id,
                        "unit_id": self.unit.id,
                        "inspection_date": "2026-07-01",
                        "report_date": "2026-07-01",
                    },
                }
            ]
        )
        insp = Inspection.objects.get(client_id=client_id)
        insp.methodology_text = "Servidor"
        insp.save()

        result = self._push(
            [
                {
                    "mutation_id": str(uuid.uuid4()),
                    "type": "inspection.update",
                    "payload": {
                        "client_id": client_id,
                        "methodology_text": "Cliente",
                        "expected_updated_at": (timezone.now() - timezone.timedelta(hours=1)).isoformat(),
                    },
                }
            ]
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.data["conflicts"]), 1)
        insp.refresh_from_db()
        self.assertEqual(insp.methodology_text, "Servidor")

    def test_pull_delta_mine_only(self):
        client_id = str(uuid.uuid4())
        self._push(
            [
                {
                    "mutation_id": str(uuid.uuid4()),
                    "type": "inspection.create",
                    "payload": {
                        "client_id": client_id,
                        "unit_id": self.unit.id,
                        "inspection_date": "2026-07-01",
                        "report_date": "2026-07-01",
                    },
                }
            ]
        )
        since = (timezone.now() - timezone.timedelta(days=1)).isoformat()
        pull = self.client.get("/sync/pull", {"since": since})
        self.assertEqual(pull.status_code, 200)
        self.assertGreaterEqual(len(pull.data["inspections"]), 1)
        self.assertTrue(any(row["client_id"] == client_id for row in pull.data["inspections"]))

        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        pull_other = other_client.get("/sync/pull", {"since": since})
        self.assertEqual(pull_other.status_code, 200)
        self.assertFalse(any(row["client_id"] == client_id for row in pull_other.data["inspections"]))
