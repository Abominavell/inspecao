"""Integration test for Django REST Framework API."""
import os
import sys
from pathlib import Path

import django

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

import httpx  # noqa: E402

API = "http://localhost:8000"

UNIT = {
    "name": "Unidade Teste Integração",
    "regional": "Norte",
    "city": "São Luís/MA",
    "address": "Rua Teste, 100",
    "unit_type": "Prédio Administrativo",
    "employee_count": 50,
    "admin_coordinator": "Coordenador Teste",
    "general_director": "Diretor Teste",
    "characterization": "Recepção, consultórios e copa.",
}

TEXTS = {
    "general_info_text": "Relatório realizado na unidade de teste.",
    "methodology_text": "Vistoria in loco e checklist aplicado.",
    "objectives_text": "Mapear não conformidades e apresentar resultados.",
    "limitations_text": "Informações baseadas nos dados fornecidos pela unidade.",
    "final_considerations_text": "Inspeção concluída com registros de NC.",
}


def main():
    with httpx.Client(base_url=API, timeout=120) as client:
        assert client.get("/health").status_code == 200

        r = client.post("/auth/login/json", json={"email": "admin@ssma.com.br", "password": "admin123"})
        assert r.status_code == 200, r.text
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        sections = client.get("/checklist", headers=headers).json()
        assert len(sections) >= 20

        unit_id = client.post("/units", headers=headers, json=UNIT).json()["id"]
        insp = client.post(
            "/inspections",
            headers=headers,
            json={"unit_id": unit_id, "inspection_date": "2024-01-15", "report_date": "2024-01-20"},
        ).json()
        assert insp["methodology_text"] == ""

        client.patch(f"/inspections/{insp['id']}", headers=headers, json=TEXTS)

        all_answers = []
        for section in sections:
            for i, item in enumerate(section["items"]):
                status = "C" if i % 3 != 0 else "NC"
                all_answers.append(
                    {
                        "checklist_item_id": item["id"],
                        "status": status,
                        "description": "Descrição NC teste" if status == "NC" else "",
                        "recommendation": "Realizar adequação." if status == "NC" else "",
                        "normative": "",
                    }
                )
        r = client.put(f"/inspections/{insp['id']}/answers", headers=headers, json={"answers": all_answers})
        assert r.status_code == 200, r.text

        comp = client.get(f"/inspections/{insp['id']}/completeness", headers=headers).json()
        assert comp["ready_for_report"], comp.get("errors")

        r = client.post(f"/inspections/{insp['id']}/report/pdf", headers=headers)
        assert r.status_code == 200 and len(r.content) > 1000

        incomplete = client.post(
            "/inspections",
            headers=headers,
            json={"unit_id": unit_id, "inspection_date": "2024-02-01", "report_date": "2024-02-05"},
        ).json()["id"]
        assert client.post(f"/inspections/{incomplete}/report/pdf", headers=headers).status_code == 400

        print("=== Todos os testes passaram ===")


if __name__ == "__main__":
    main()
