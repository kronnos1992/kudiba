from datetime import date, datetime, timezone
from unittest.mock import MagicMock
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app
from src.presentation.http.dependencies import get_app_state

TENANT_ID = "a0000000-0000-0000-0000-000000000001"
HEADERS = {"X-Resolved-Tenant-ID": TENANT_ID}


class _InMemoryConflictRepo:
    def __init__(self):
        self.cases = {}
        self.actions = {}

    def _to_summary(self, case: dict) -> dict:
        return {
            k: v
            for k, v in case.items()
            if k not in ("participants", "meetings", "actions", "follow_ups", "audit_logs")
        } | {
            "participants_count": len(case["participants"]),
            "meetings_count": len(case["meetings"]),
            "actions_count": len(case["actions"]),
        }

    def _to_detail(self, case: dict) -> dict:
        return self._to_summary(case) | {
            "participants": list(case["participants"]),
            "meetings": list(case["meetings"]),
            "actions": list(case["actions"]),
            "follow_ups": list(case["follow_ups"]),
            "audit_logs": list(case["audit_logs"]),
        }

    async def get_dashboard(self, tenant_id):
        tenant_cases = [c for c in self.cases.values() if str(c["tenant_id"]) == str(tenant_id)]
        resolved = sum(1 for c in tenant_cases if c["status"] == "RESOLVIDO")
        return {
            "total_cases": len(tenant_cases),
            "open_cases": len(tenant_cases) - resolved,
            "in_mediation": sum(1 for c in tenant_cases if c["status"] == "EM_MEDIACAO"),
            "in_investigation": sum(1 for c in tenant_cases if c["status"] == "EM_INVESTIGACAO"),
            "resolved": resolved,
            "critical_cases": sum(1 for c in tenant_cases if c["severity"] == "CRITICA"),
            "high_retaliation_risk": sum(1 for c in tenant_cases if c["retaliation_risk"]),
            "retaliation_alerts": sum(1 for c in tenant_cases if c["retaliation_risk"]),
            "pending_actions": sum(
                1
                for c in tenant_cases
                for a in c["actions"]
                if a["status"] in ("PENDING", "IN_PROGRESS")
            ),
            "overdue_actions": 0,
            "resolution_rate_percent": (resolved / len(tenant_cases) * 100.0) if tenant_cases else 0.0,
            "avg_resolution_days": 4.0 if resolved else 0.0,
            "by_type": {},
            "by_severity": {},
            "by_status": {},
            "by_department": {},
        }

    async def create_case(self, tenant_id, req):
        now = datetime.now(timezone.utc)
        case_id = uuid.uuid4()
        seq = len(self.cases) + 1
        participants = []
        if req.complainant_name:
            participants.append(
                {
                    "id": uuid.uuid4(),
                    "case_id": case_id,
                    "tenant_id": tenant_id,
                    "employee_id": req.complainant_employee_id,
                    "name": req.complainant_name,
                    "role": "COMPLAINANT",
                    "statement": None,
                    "statement_date": None,
                    "has_conflict_of_interest": False,
                    "conflict_of_interest_details": None,
                    "created_at": now,
                }
            )
        if req.respondent_name:
            participants.append(
                {
                    "id": uuid.uuid4(),
                    "case_id": case_id,
                    "tenant_id": tenant_id,
                    "employee_id": req.respondent_employee_id,
                    "name": req.respondent_name,
                    "role": "RESPONDENT",
                    "statement": None,
                    "statement_date": None,
                    "has_conflict_of_interest": False,
                    "conflict_of_interest_details": None,
                    "created_at": now,
                }
            )
        case = {
            "id": case_id,
            "tenant_id": tenant_id,
            "reference_code": f"RH-CON-2026-{seq:04d}",
            "title": req.title,
            "conflict_type": req.conflict_type,
            "severity": req.severity,
            "status": "EM_TRIAGEM",
            "department_id": getattr(req, "department_id", None),
            "department_name": getattr(req, "department_name", None),
            "incident_date": getattr(req, "incident_date", None) or date.today(),
            "reported_at": now,
            "is_confidential": getattr(req, "is_confidential", False),
            "complainant_employee_id": getattr(req, "complainant_employee_id", None),
            "complainant_name": getattr(req, "complainant_name", None),
            "respondent_employee_id": getattr(req, "respondent_employee_id", None),
            "respondent_name": getattr(req, "respondent_name", None),
            "assigned_mediator_id": getattr(req, "assigned_mediator_id", None),
            "assigned_mediator_name": getattr(req, "assigned_mediator_name", None),
            "resolution_route": getattr(req, "resolution_route", "MEDIACAO"),
            "summary": req.summary,
            "retaliation_risk": getattr(req, "retaliation_risk", False),
            "urgent_protection_measures": getattr(req, "urgent_protection_measures", None),
            "closure_reason": None,
            "closed_at": None,
            "created_at": now,
            "updated_at": now,
            "participants": participants,
            "meetings": [],
            "actions": [],
            "follow_ups": [],
            "audit_logs": [
                {
                    "id": uuid.uuid4(),
                    "case_id": case_id,
                    "tenant_id": tenant_id,
                    "action": "CREATE",
                    "performed_by": "RH",
                    "details": "Caso registado",
                    "created_at": now,
                }
            ],
        }
        self.cases[case_id] = case
        return self._to_detail(case)

    async def list_cases(self, tenant_id, status=None, severity=None, conflict_type=None, search=None):
        res = []
        for c in self.cases.values():
            if str(c["tenant_id"]) != str(tenant_id):
                continue
            if search and search.lower() not in c["title"].lower() and search.lower() not in c["summary"].lower():
                continue
            res.append(self._to_summary(c))
        return res

    async def get_case_by_id(self, tenant_id, case_id):
        c = self.cases.get(case_id)
        return self._to_detail(c) if c else None

    async def triage_case(self, tenant_id, case_id, req):
        now = datetime.now(timezone.utc)
        c = self.cases[case_id]
        c["severity"] = req.severity
        c["resolution_route"] = req.resolution_route
        c["assigned_mediator_id"] = req.assigned_mediator_id
        c["assigned_mediator_name"] = req.assigned_mediator_name
        c["retaliation_risk"] = req.retaliation_risk
        c["urgent_protection_measures"] = req.urgent_protection_measures
        if req.status:
            c["status"] = req.status
        c["updated_at"] = now
        c["audit_logs"].append(
            {
                "id": uuid.uuid4(),
                "case_id": case_id,
                "tenant_id": tenant_id,
                "action": "TRIAGE",
                "performed_by": "RH",
                "details": "Triagem efetuada",
                "created_at": now,
            }
        )
        return self._to_detail(c)

    async def add_participant(self, tenant_id, case_id, req):
        now = datetime.now(timezone.utc)
        c = self.cases[case_id]
        part = {
            "id": uuid.uuid4(),
            "case_id": case_id,
            "tenant_id": tenant_id,
            "employee_id": req.employee_id,
            "name": req.name,
            "role": req.role,
            "statement": req.statement,
            "statement_date": now if req.statement else None,
            "has_conflict_of_interest": req.has_conflict_of_interest,
            "conflict_of_interest_details": req.conflict_of_interest_details,
            "created_at": now,
        }
        c["participants"].append(part)
        c["audit_logs"].append(
            {
                "id": uuid.uuid4(),
                "case_id": case_id,
                "tenant_id": tenant_id,
                "action": "ADD_PARTICIPANT",
                "performed_by": "RH",
                "details": req.name,
                "created_at": now,
            }
        )
        return part

    async def create_meeting(self, tenant_id, case_id, req):
        now = datetime.now(timezone.utc)
        c = self.cases[case_id]
        meeting = {
            "id": uuid.uuid4(),
            "case_id": case_id,
            "tenant_id": tenant_id,
            "meeting_type": req.meeting_type,
            "scheduled_at": req.scheduled_at,
            "location": req.location,
            "conducted_by": req.conducted_by,
            "attendees": req.attendees,
            "minutes": req.minutes,
            "agreed_points": req.agreed_points,
            "status": req.status,
            "created_at": now,
        }
        c["meetings"].append(meeting)
        c["audit_logs"].append(
            {
                "id": uuid.uuid4(),
                "case_id": case_id,
                "tenant_id": tenant_id,
                "action": "MEETING",
                "performed_by": "RH",
                "details": req.meeting_type,
                "created_at": now,
            }
        )
        return meeting

    async def create_action(self, tenant_id, case_id, req):
        now = datetime.now(timezone.utc)
        c = self.cases[case_id]
        act = {
            "id": uuid.uuid4(),
            "case_id": case_id,
            "tenant_id": tenant_id,
            "title": req.title,
            "description": req.description,
            "action_type": req.action_type,
            "assigned_to": req.assigned_to,
            "due_date": req.due_date,
            "status": "PENDING",
            "completion_notes": None,
            "completed_at": None,
            "created_at": now,
        }
        c["actions"].append(act)
        self.actions[act["id"]] = (c, act)
        c["audit_logs"].append(
            {
                "id": uuid.uuid4(),
                "case_id": case_id,
                "tenant_id": tenant_id,
                "action": "ACTION_CREATED",
                "performed_by": "RH",
                "details": req.title,
                "created_at": now,
            }
        )
        return act

    async def update_action(self, tenant_id, action_id, req):
        now = datetime.now(timezone.utc)
        c, act = self.actions[action_id]
        act["status"] = req.status
        act["completion_notes"] = req.completion_notes
        if req.status == "COMPLETED":
            act["completed_at"] = now
        return act

    async def create_follow_up(self, tenant_id, case_id, req):
        now = datetime.now(timezone.utc)
        c = self.cases[case_id]
        fol = {
            "id": uuid.uuid4(),
            "case_id": case_id,
            "tenant_id": tenant_id,
            "review_date": req.review_date,
            "reviewed_by": req.reviewed_by,
            "feedback_complainant": req.feedback_complainant,
            "feedback_respondent": req.feedback_respondent,
            "retaliation_detected": req.retaliation_detected,
            "is_stable": req.is_stable,
            "notes": req.notes,
            "created_at": now,
        }
        c["follow_ups"].append(fol)
        c["audit_logs"].append(
            {
                "id": uuid.uuid4(),
                "case_id": case_id,
                "tenant_id": tenant_id,
                "action": "FOLLOW_UP",
                "performed_by": req.reviewed_by,
                "details": req.notes,
                "created_at": now,
            }
        )
        return fol

    async def update_status(self, tenant_id, case_id, req):
        now = datetime.now(timezone.utc)
        c = self.cases[case_id]
        c["status"] = req.status
        c["closure_reason"] = req.closure_reason
        if req.status in ("RESOLVIDO", "ENCERRADO"):
            c["closed_at"] = now
        c["audit_logs"].append(
            {
                "id": uuid.uuid4(),
                "case_id": case_id,
                "tenant_id": tenant_id,
                "action": "STATUS_CHANGE",
                "performed_by": "RH",
                "details": req.status,
                "created_at": now,
            }
        )
        return self._to_detail(c)


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
    mock_state = MagicMock()
    mock_state.conflict_repo = _InMemoryConflictRepo()
    app.dependency_overrides[get_app_state] = lambda: mock_state
    try:
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
            list_res = await ac.get("/api/v1/payroll/conflicts?search=comunicação", headers=HEADERS)
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
    finally:
        app.dependency_overrides.clear()
