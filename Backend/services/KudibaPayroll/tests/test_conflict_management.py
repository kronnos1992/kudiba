import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app

TENANT_ID = "a0000000-0000-0000-0000-000000000001"
HEADERS = {"X-Resolved-Tenant-ID": TENANT_ID}


def test_conflict_routes_are_registered():
    paths = app.openapi()["paths"]
    assert "/api/v1/payroll/conflicts" in paths
    assert "/api/v1/payroll/conflicts/dashboard" in paths
    assert "/api/v1/payroll/conflicts/{case_id}" in paths
    assert "/api/v1/payroll/conflicts/{case_id}/status" in paths
    assert "/api/v1/payroll/conflicts/{case_id}/triage" in paths
    assert "/api/v1/payroll/conflicts/{case_id}/participants" in paths
    assert "/api/v1/payroll/conflicts/{case_id}/meetings" in paths
    assert "/api/v1/payroll/conflicts/{case_id}/actions" in paths
    assert "/api/v1/payroll/conflicts/actions/{action_id}" in paths
    assert "/api/v1/payroll/conflicts/{case_id}/follow-ups" in paths


@pytest.mark.asyncio
async def test_conflict_lifecycle_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Obter dashboard inicial
        dash_res = await ac.get("/api/v1/payroll/conflicts/dashboard", headers=HEADERS)
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert "total_cases" in dash_data
        assert "by_type" in dash_data
        initial_total = dash_data["total_cases"]

        # 2. Criar novo caso de conflito
        new_case_payload = {
            "title": "Divergência de comunicação interna e alocação de ferramentas",
            "conflict_type": "INTERPESSOAL",
            "severity": "MEDIA",
            "incident_date": "2026-03-20",
            "is_confidential": False,
            "complainant_name": "João Baptista",
            "respondent_name": "António Silva",
            "summary": "Desentendimento sobre o uso partilhado de equipamentos de medição técnica.",
            "retaliation_risk": False,
            "urgent_protection_measures": None,
        }
        create_res = await ac.post("/api/v1/payroll/conflicts", json=new_case_payload, headers=HEADERS)
        assert create_res.status_code == 201
        created_case = create_res.json()
        case_id = created_case["id"]
        assert created_case["reference_code"].startswith("RH-CON-")
        assert created_case["status"] == "EM_TRIAGEM"
        assert len(created_case["participants"]) >= 2
        assert len(created_case["audit_logs"]) >= 1

        # 3. Listar casos com filtro
        list_res = await ac.get(f"/api/v1/payroll/conflicts?search=comunicação", headers=HEADERS)
        assert list_res.status_code == 200
        cases = list_res.json()
        assert any(c["id"] == case_id for c in cases)

        # 4. Triagem do caso
        triage_payload = {
            "severity": "MEDIA",
            "resolution_route": "MEDIACAO",
            "assigned_mediator_id": "dr.mediador@kudiba.ao",
            "assigned_mediator_name": "Dr. Fernando Mediador",
            "retaliation_risk": False,
            "urgent_protection_measures": None,
            "status": "EM_MEDIACAO",
        }
        triage_res = await ac.post(
            f"/api/v1/payroll/conflicts/{case_id}/triage", json=triage_payload, headers=HEADERS
        )
        assert triage_res.status_code == 200
        triaged = triage_res.json()
        assert triaged["status"] == "EM_MEDIACAO"
        assert triaged["assigned_mediator_name"] == "Dr. Fernando Mediador"

        # 5. Adicionar testemunha / participante
        part_payload = {
            "name": "Maria Fernandes",
            "role": "WITNESS",
            "statement": "Presenciei a discussão e confirmo que ambos concordam em resolver amigavelmente.",
            "has_conflict_of_interest": False,
        }
        part_res = await ac.post(
            f"/api/v1/payroll/conflicts/{case_id}/participants", json=part_payload, headers=HEADERS
        )
        assert part_res.status_code == 201
        part_data = part_res.json()
        assert part_data["role"] == "WITNESS"

        # 6. Agendar / Registar Reunião de Mediação
        meeting_payload = {
            "meeting_type": "JOINT_MEDIATION",
            "scheduled_at": "2026-03-21T10:00:00Z",
            "location": "Gabinete RH Confidencial",
            "conducted_by": "Dr. Fernando Mediador",
            "attendees": "João Baptista, António Silva, Maria Fernandes",
            "minutes": "Ambas as partes expuseram as suas razões e acordaram um protocolo de utilização.",
            "agreed_points": "1. Registo em folha de saída; 2. Limpeza prévia.",
            "status": "COMPLETED",
        }
        meeting_res = await ac.post(
            f"/api/v1/payroll/conflicts/{case_id}/meetings", json=meeting_payload, headers=HEADERS
        )
        assert meeting_res.status_code == 201
        meeting_data = meeting_res.json()
        assert meeting_data["status"] == "COMPLETED"

        # 7. Criar Ação Corretiva
        action_payload = {
            "title": "Afixação de regras de equipamento técnico",
            "description": "Elaborar mapa de escala e afixar junto ao armário de ferramentas.",
            "action_type": "MELHORIA_PROCESSO",
            "assigned_to": "João Baptista",
            "due_date": "2026-03-25",
        }
        action_res = await ac.post(
            f"/api/v1/payroll/conflicts/{case_id}/actions", json=action_payload, headers=HEADERS
        )
        assert action_res.status_code == 201
        action_data = action_res.json()
        action_id = action_data["id"]

        # 8. Atualizar Ação Corretiva
        update_action_payload = {
            "status": "COMPLETED",
            "completion_notes": "Placa e regulamento afixados com sucesso.",
        }
        update_act_res = await ac.patch(
            f"/api/v1/payroll/conflicts/actions/{action_id}", json=update_action_payload, headers=HEADERS
        )
        assert update_act_res.status_code == 200
        assert update_act_res.json()["status"] == "COMPLETED"

        # 9. Registar Acompanhamento Pós-Resolução
        follow_up_payload = {
            "review_date": "2026-03-26",
            "reviewed_by": "Dr. Fernando Mediador",
            "feedback_complainant": "Tudo calmo e organizado.",
            "feedback_respondent": "Relação normalizada.",
            "retaliation_detected": False,
            "is_stable": True,
            "notes": "Conflito resolvido sem incidências adicionais.",
        }
        fol_res = await ac.post(
            f"/api/v1/payroll/conflicts/{case_id}/follow-ups", json=follow_up_payload, headers=HEADERS
        )
        assert fol_res.status_code == 201

        # 10. Atualizar Estado Final para RESOLVIDO
        status_payload = {
            "status": "RESOLVIDO",
            "closure_reason": "Acordo cumprido e compromissos validados com sucesso.",
        }
        status_res = await ac.patch(
            f"/api/v1/payroll/conflicts/{case_id}/status", json=status_payload, headers=HEADERS
        )
        assert status_res.status_code == 200
        closed_case = status_res.json()
        assert closed_case["status"] == "RESOLVIDO"
        assert closed_case["closure_reason"] is not None

        # 11. Obter Detalhes do Caso
        get_res = await ac.get(f"/api/v1/payroll/conflicts/{case_id}", headers=HEADERS)
        assert get_res.status_code == 200
        final_case = get_res.json()
        assert len(final_case["actions"]) >= 1
        assert len(final_case["meetings"]) >= 1
        assert len(final_case["follow_ups"]) >= 1
        assert len(final_case["audit_logs"]) >= 6

        # 12. Validar Dashboard atualizado
        dash_after = await ac.get("/api/v1/payroll/conflicts/dashboard", headers=HEADERS)
        assert dash_after.status_code == 200
        dash_after_data = dash_after.json()
        assert dash_after_data["total_cases"] == initial_total + 1
        assert dash_after_data["resolved"] >= 1
