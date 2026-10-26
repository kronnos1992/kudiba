import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.application.dto import (
    AddParticipantRequest,
    ConflictActionResponse,
    ConflictAuditLogResponse,
    ConflictCaseDetailResponse,
    ConflictCaseSummaryResponse,
    ConflictDashboardResponse,
    ConflictFollowUpResponse,
    ConflictMeetingResponse,
    ConflictParticipantResponse,
    CreateActionRequest,
    CreateConflictCaseRequest,
    CreateFollowUpRequest,
    CreateMeetingRequest,
    TriageConflictCaseRequest,
    UpdateActionRequest,
    UpdateConflictStatusRequest,
)
from src.domain.error import EntityNotFoundError, ValidationError
from src.infrastructure.persistence.models import (
    ConflictActionModel,
    ConflictAuditLogModel,
    ConflictCaseModel,
    ConflictFollowUpModel,
    ConflictMeetingModel,
    ConflictParticipantModel,
    DepartmentModel,
)


class PostgresConflictRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    async def _generate_reference_code(self, session: AsyncSession, tenant_id: UUID) -> str:
        current_year = datetime.now(timezone.utc).year
        prefix = f"RH-CON-{current_year}-"
        stmt = (
            select(ConflictCaseModel.reference_code)
            .where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.reference_code.like(f"{prefix}%"),
            )
            .order_by(ConflictCaseModel.reference_code.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        last_ref = result.scalar_one_or_none()
        if last_ref:
            try:
                seq = int(last_ref.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    @staticmethod
    def _to_summary(model: ConflictCaseModel) -> ConflictCaseSummaryResponse:
        return ConflictCaseSummaryResponse(
            id=model.id,
            tenant_id=model.tenant_id,
            reference_code=model.reference_code,
            title=model.title,
            conflict_type=model.conflict_type,
            severity=model.severity,
            status=model.status,
            department_id=model.department_id,
            department_name=model.department_name,
            incident_date=model.incident_date,
            reported_at=model.reported_at,
            is_confidential=model.is_confidential,
            complainant_employee_id=model.complainant_employee_id,
            complainant_name=model.complainant_name,
            respondent_employee_id=model.respondent_employee_id,
            respondent_name=model.respondent_name,
            assigned_mediator_id=model.assigned_mediator_id,
            assigned_mediator_name=model.assigned_mediator_name,
            resolution_route=model.resolution_route,
            summary=model.summary,
            retaliation_risk=model.retaliation_risk,
            urgent_protection_measures=model.urgent_protection_measures,
            closure_reason=model.closure_reason,
            closed_at=model.closed_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
            participants_count=len(model.participants) if model.participants is not None else 0,
            meetings_count=len(model.meetings) if model.meetings is not None else 0,
            actions_count=len(model.actions) if model.actions is not None else 0,
        )

    @staticmethod
    def _to_detail(model: ConflictCaseModel) -> ConflictCaseDetailResponse:
        summary = PostgresConflictRepository._to_summary(model)
        return ConflictCaseDetailResponse(
            **summary.model_dump(),
            participants=[
                ConflictParticipantResponse(
                    id=p.id,
                    case_id=p.case_id,
                    tenant_id=p.tenant_id,
                    employee_id=p.employee_id,
                    name=p.name,
                    role=p.role,
                    statement=p.statement,
                    statement_date=p.statement_date,
                    has_conflict_of_interest=p.has_conflict_of_interest,
                    conflict_of_interest_details=p.conflict_of_interest_details,
                    created_at=p.created_at,
                )
                for p in sorted(model.participants or [], key=lambda x: x.created_at)
            ],
            meetings=[
                ConflictMeetingResponse(
                    id=m.id,
                    case_id=m.case_id,
                    tenant_id=m.tenant_id,
                    meeting_type=m.meeting_type,
                    scheduled_at=m.scheduled_at,
                    location=m.location,
                    conducted_by=m.conducted_by,
                    attendees=m.attendees,
                    minutes=m.minutes,
                    agreed_points=m.agreed_points,
                    status=m.status,
                    created_at=m.created_at,
                )
                for m in sorted(model.meetings or [], key=lambda x: x.scheduled_at, reverse=True)
            ],
            actions=[
                ConflictActionResponse(
                    id=a.id,
                    case_id=a.case_id,
                    tenant_id=a.tenant_id,
                    title=a.title,
                    description=a.description,
                    action_type=a.action_type,
                    assigned_to=a.assigned_to,
                    due_date=a.due_date,
                    status=a.status,
                    completion_notes=a.completion_notes,
                    completed_at=a.completed_at,
                    created_at=a.created_at,
                )
                for a in sorted(model.actions or [], key=lambda x: x.due_date)
            ],
            follow_ups=[
                ConflictFollowUpResponse(
                    id=f.id,
                    case_id=f.case_id,
                    tenant_id=f.tenant_id,
                    review_date=f.review_date,
                    reviewed_by=f.reviewed_by,
                    feedback_complainant=f.feedback_complainant,
                    feedback_respondent=f.feedback_respondent,
                    retaliation_detected=f.retaliation_detected,
                    is_stable=f.is_stable,
                    notes=f.notes,
                    created_at=f.created_at,
                )
                for f in sorted(model.follow_ups or [], key=lambda x: x.review_date, reverse=True)
            ],
            audit_logs=[
                ConflictAuditLogResponse(
                    id=l.id,
                    case_id=l.case_id,
                    tenant_id=l.tenant_id,
                    action=l.action,
                    performed_by=l.performed_by,
                    details=l.details,
                    created_at=l.created_at,
                )
                for l in sorted(model.audit_logs or [], key=lambda x: x.created_at, reverse=True)
            ],
        )

    async def list_cases(
        self,
        tenant_id: UUID,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        conflict_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[ConflictCaseSummaryResponse]:
        async with self.session_factory() as session:
            query = select(ConflictCaseModel).where(ConflictCaseModel.tenant_id == tenant_id)

            if status:
                query = query.where(ConflictCaseModel.status == status)
            if severity:
                query = query.where(ConflictCaseModel.severity == severity)
            if conflict_type:
                query = query.where(ConflictCaseModel.conflict_type == conflict_type)
            if search:
                pattern = f"%{search}%"
                query = query.where(
                    or_(
                        ConflictCaseModel.reference_code.ilike(pattern),
                        ConflictCaseModel.title.ilike(pattern),
                        ConflictCaseModel.summary.ilike(pattern),
                        ConflictCaseModel.complainant_name.ilike(pattern),
                        ConflictCaseModel.respondent_name.ilike(pattern),
                    )
                )

            query = query.order_by(ConflictCaseModel.created_at.desc())
            result = await session.execute(query)
            cases = result.scalars().all()
            return [self._to_summary(c) for c in cases]

    async def get_case_by_id(self, tenant_id: UUID, case_id: UUID) -> Optional[ConflictCaseDetailResponse]:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            result = await session.execute(stmt)
            case = result.scalar_one_or_none()
            if not case:
                return None
            return self._to_detail(case)

    async def create_case(
        self,
        tenant_id: UUID,
        req: CreateConflictCaseRequest,
        performed_by: str = "Técnico de RH",
    ) -> ConflictCaseDetailResponse:
        async with self.session_factory() as session:
            ref_code = await self._generate_reference_code(session, tenant_id)

            dept_name = None
            if req.department_id:
                dept_stmt = select(DepartmentModel.name).where(
                    DepartmentModel.tenant_id == tenant_id,
                    DepartmentModel.id == req.department_id,
                )
                dept_res = await session.execute(dept_stmt)
                dept_name = dept_res.scalar_one_or_none()

            case = ConflictCaseModel(
                tenant_id=tenant_id,
                reference_code=ref_code,
                title=req.title,
                conflict_type=req.conflict_type,
                severity=req.severity,
                status="EM_TRIAGEM",
                department_id=req.department_id,
                department_name=dept_name,
                incident_date=req.incident_date,
                is_confidential=req.is_confidential,
                complainant_employee_id=req.complainant_employee_id,
                complainant_name=req.complainant_name,
                respondent_employee_id=req.respondent_employee_id,
                respondent_name=req.respondent_name,
                summary=req.summary,
                retaliation_risk=req.retaliation_risk,
                urgent_protection_measures=req.urgent_protection_measures,
            )
            session.add(case)
            await session.flush()

            if req.complainant_name:
                p1 = ConflictParticipantModel(
                    case_id=case.id,
                    tenant_id=tenant_id,
                    employee_id=req.complainant_employee_id,
                    name=req.complainant_name,
                    role="COMPLAINANT",
                )
                session.add(p1)

            if req.respondent_name:
                p2 = ConflictParticipantModel(
                    case_id=case.id,
                    tenant_id=tenant_id,
                    employee_id=req.respondent_employee_id,
                    name=req.respondent_name,
                    role="RESPONDENT",
                )
                session.add(p2)

            audit = ConflictAuditLogModel(
                case_id=case.id,
                tenant_id=tenant_id,
                action="CRIACAO_CASO",
                performed_by=performed_by,
                details=f"Ocorrência {ref_code} registada. Confidencial: {req.is_confidential}.",
            )
            session.add(audit)
            await session.commit()

            return await self.get_case_by_id(tenant_id, case.id)

    async def triage_case(
        self,
        tenant_id: UUID,
        case_id: UUID,
        req: TriageConflictCaseRequest,
        performed_by: str = "Técnico de RH",
    ) -> ConflictCaseDetailResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            result = await session.execute(stmt)
            case = result.scalar_one_or_none()
            if not case:
                raise EntityNotFoundError("Caso de Conflito", str(case_id))

            case.severity = req.severity
            case.resolution_route = req.resolution_route
            if req.assigned_mediator_id is not None:
                case.assigned_mediator_id = req.assigned_mediator_id
            if req.assigned_mediator_name is not None:
                case.assigned_mediator_name = req.assigned_mediator_name
            case.retaliation_risk = req.retaliation_risk
            case.urgent_protection_measures = req.urgent_protection_measures

            if req.status:
                case.status = req.status
            elif case.status == "EM_TRIAGEM":
                if req.resolution_route == "INVESTIGACAO_DISCIPLINAR":
                    case.status = "EM_INVESTIGACAO"
                elif req.resolution_route == "ENCAMINHAMENTO_JURIDICO":
                    case.status = "ENCAMINHADO_DISCIPLINAR"
                else:
                    case.status = "EM_MEDIACAO"

            case.updated_at = datetime.now(timezone.utc)

            audit = ConflictAuditLogModel(
                case_id=case.id,
                tenant_id=tenant_id,
                action="TRIAGEM",
                performed_by=performed_by,
                details=f"Triagem concluída: Rota '{req.resolution_route}', Severidade '{req.severity}', Estado '{case.status}'.",
            )
            session.add(audit)
            await session.commit()

            return await self.get_case_by_id(tenant_id, case.id)

    async def update_status(
        self,
        tenant_id: UUID,
        case_id: UUID,
        req: UpdateConflictStatusRequest,
        performed_by: str = "Gestor de RH",
    ) -> ConflictCaseDetailResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            result = await session.execute(stmt)
            case = result.scalar_one_or_none()
            if not case:
                raise EntityNotFoundError("Caso de Conflito", str(case_id))

            old_status = case.status
            case.status = req.status
            case.updated_at = datetime.now(timezone.utc)

            if req.status in ("RESOLVIDO", "ENCERRADO", "ENCAMINHADO_DISCIPLINAR"):
                case.closure_reason = req.closure_reason
                case.closed_at = datetime.now(timezone.utc)

            audit = ConflictAuditLogModel(
                case_id=case.id,
                tenant_id=tenant_id,
                action="ALTERACAO_ESTADO",
                performed_by=performed_by,
                details=f"Transição de '{old_status}' para '{req.status}'. Motivo: {req.closure_reason or 'Sem notas adicionais'}.",
            )
            session.add(audit)
            await session.commit()

            return await self.get_case_by_id(tenant_id, case.id)

    async def add_participant(
        self,
        tenant_id: UUID,
        case_id: UUID,
        req: AddParticipantRequest,
        performed_by: str = "Técnico de RH",
    ) -> ConflictParticipantResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel.id).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                raise EntityNotFoundError("Caso de Conflito", str(case_id))

            participant = ConflictParticipantModel(
                case_id=case_id,
                tenant_id=tenant_id,
                employee_id=req.employee_id,
                name=req.name,
                role=req.role,
                statement=req.statement,
                statement_date=datetime.now(timezone.utc) if req.statement else None,
                has_conflict_of_interest=req.has_conflict_of_interest,
                conflict_of_interest_details=req.conflict_of_interest_details,
            )
            session.add(participant)

            audit = ConflictAuditLogModel(
                case_id=case_id,
                tenant_id=tenant_id,
                action="ADICAO_PARTICIPANTE",
                performed_by=performed_by,
                details=f"Adicionado participante: {req.name} ({req.role}).",
            )
            session.add(audit)
            await session.commit()

            return ConflictParticipantResponse(
                id=participant.id,
                case_id=participant.case_id,
                tenant_id=participant.tenant_id,
                employee_id=participant.employee_id,
                name=participant.name,
                role=participant.role,
                statement=participant.statement,
                statement_date=participant.statement_date,
                has_conflict_of_interest=participant.has_conflict_of_interest,
                conflict_of_interest_details=participant.conflict_of_interest_details,
                created_at=participant.created_at,
            )

    async def create_meeting(
        self,
        tenant_id: UUID,
        case_id: UUID,
        req: CreateMeetingRequest,
        performed_by: str = "Mediador",
    ) -> ConflictMeetingResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel.id).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                raise EntityNotFoundError("Caso de Conflito", str(case_id))

            meeting = ConflictMeetingModel(
                case_id=case_id,
                tenant_id=tenant_id,
                meeting_type=req.meeting_type,
                scheduled_at=req.scheduled_at,
                location=req.location,
                conducted_by=req.conducted_by,
                attendees=req.attendees,
                minutes=req.minutes,
                agreed_points=req.agreed_points,
                status=req.status,
            )
            session.add(meeting)

            audit = ConflictAuditLogModel(
                case_id=case_id,
                tenant_id=tenant_id,
                action="REGISTO_REUNIAO",
                performed_by=performed_by,
                details=f"Sessão de {req.meeting_type} por {req.conducted_by} em {req.scheduled_at.isoformat()}.",
            )
            session.add(audit)
            await session.commit()

            return ConflictMeetingResponse(
                id=meeting.id,
                case_id=meeting.case_id,
                tenant_id=meeting.tenant_id,
                meeting_type=meeting.meeting_type,
                scheduled_at=meeting.scheduled_at,
                location=meeting.location,
                conducted_by=meeting.conducted_by,
                attendees=meeting.attendees,
                minutes=meeting.minutes,
                agreed_points=meeting.agreed_points,
                status=meeting.status,
                created_at=meeting.created_at,
            )

    async def create_action(
        self,
        tenant_id: UUID,
        case_id: UUID,
        req: CreateActionRequest,
        performed_by: str = "Mediador",
    ) -> ConflictActionResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel.id).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                raise EntityNotFoundError("Caso de Conflito", str(case_id))

            action = ConflictActionModel(
                case_id=case_id,
                tenant_id=tenant_id,
                title=req.title,
                description=req.description,
                action_type=req.action_type,
                assigned_to=req.assigned_to,
                due_date=req.due_date,
                status="PENDING",
            )
            session.add(action)

            audit = ConflictAuditLogModel(
                case_id=case_id,
                tenant_id=tenant_id,
                action="CRIACAO_ACAO",
                performed_by=performed_by,
                details=f"Ação corretiva '{req.title}' atribuída a {req.assigned_to} até {req.due_date}.",
            )
            session.add(audit)
            await session.commit()

            return ConflictActionResponse(
                id=action.id,
                case_id=action.case_id,
                tenant_id=action.tenant_id,
                title=action.title,
                description=action.description,
                action_type=action.action_type,
                assigned_to=action.assigned_to,
                due_date=action.due_date,
                status=action.status,
                completion_notes=action.completion_notes,
                completed_at=action.completed_at,
                created_at=action.created_at,
            )

    async def update_action(
        self,
        tenant_id: UUID,
        action_id: UUID,
        req: UpdateActionRequest,
        performed_by: str = "Mediador",
    ) -> ConflictActionResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictActionModel).where(
                ConflictActionModel.tenant_id == tenant_id,
                ConflictActionModel.id == action_id,
            )
            res = await session.execute(stmt)
            action = res.scalar_one_or_none()
            if not action:
                raise EntityNotFoundError("Ação de Conflito", str(action_id))

            action.status = req.status
            if req.completion_notes is not None:
                action.completion_notes = req.completion_notes
            if req.status == "COMPLETED":
                action.completed_at = datetime.now(timezone.utc)

            audit = ConflictAuditLogModel(
                case_id=action.case_id,
                tenant_id=tenant_id,
                action="ATUALIZACAO_ACAO",
                performed_by=performed_by,
                details=f"Ação '{action.title}' atualizada para '{req.status}'.",
            )
            session.add(audit)
            await session.commit()

            return ConflictActionResponse(
                id=action.id,
                case_id=action.case_id,
                tenant_id=action.tenant_id,
                title=action.title,
                description=action.description,
                action_type=action.action_type,
                assigned_to=action.assigned_to,
                due_date=action.due_date,
                status=action.status,
                completion_notes=action.completion_notes,
                completed_at=action.completed_at,
                created_at=action.created_at,
            )

    async def create_follow_up(
        self,
        tenant_id: UUID,
        case_id: UUID,
        req: CreateFollowUpRequest,
        performed_by: str = "Técnico de RH",
    ) -> ConflictFollowUpResponse:
        async with self.session_factory() as session:
            stmt = select(ConflictCaseModel.id).where(
                ConflictCaseModel.tenant_id == tenant_id,
                ConflictCaseModel.id == case_id,
            )
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                raise EntityNotFoundError("Caso de Conflito", str(case_id))

            follow_up = ConflictFollowUpModel(
                case_id=case_id,
                tenant_id=tenant_id,
                review_date=req.review_date,
                reviewed_by=req.reviewed_by,
                feedback_complainant=req.feedback_complainant,
                feedback_respondent=req.feedback_respondent,
                retaliation_detected=req.retaliation_detected,
                is_stable=req.is_stable,
                notes=req.notes,
            )
            session.add(follow_up)

            audit = ConflictAuditLogModel(
                case_id=case_id,
                tenant_id=tenant_id,
                action="REGISTO_ACOMPANHAMENTO",
                performed_by=performed_by,
                details=f"Acompanhamento em {req.review_date} por {req.reviewed_by}. Estável: {req.is_stable}, Retaliação: {req.retaliation_detected}.",
            )
            session.add(audit)
            await session.commit()

            return ConflictFollowUpResponse(
                id=follow_up.id,
                case_id=follow_up.case_id,
                tenant_id=follow_up.tenant_id,
                review_date=follow_up.review_date,
                reviewed_by=follow_up.reviewed_by,
                feedback_complainant=follow_up.feedback_complainant,
                feedback_respondent=follow_up.feedback_respondent,
                retaliation_detected=follow_up.retaliation_detected,
                is_stable=follow_up.is_stable,
                notes=follow_up.notes,
                created_at=follow_up.created_at,
            )

    async def get_dashboard(self, tenant_id: UUID) -> ConflictDashboardResponse:
        async with self.session_factory() as session:
            cases_stmt = select(ConflictCaseModel).where(ConflictCaseModel.tenant_id == tenant_id)
            cases_res = await session.execute(cases_stmt)
            cases = cases_res.scalars().all()

            total_cases = len(cases)
            open_cases = 0
            in_mediation = 0
            in_investigation = 0
            resolved = 0
            high_retaliation_risk = 0
            resolution_days_list: List[float] = []

            by_type: dict[str, int] = {}
            by_severity: dict[str, int] = {}
            by_department: dict[str, int] = {}

            for c in cases:
                if c.status in ("RESOLVIDO", "ENCERRADO"):
                    resolved += 1
                    if c.closed_at and c.reported_at:
                        diff_days = (c.closed_at - c.reported_at).total_seconds() / 86400.0
                        if diff_days >= 0:
                            resolution_days_list.append(diff_days)
                else:
                    open_cases += 1

                if c.status == "EM_MEDIACAO":
                    in_mediation += 1
                elif c.status == "EM_INVESTIGACAO":
                    in_investigation += 1

                if c.retaliation_risk:
                    high_retaliation_risk += 1

                by_type[c.conflict_type] = by_type.get(c.conflict_type, 0) + 1
                by_severity[c.severity] = by_severity.get(c.severity, 0) + 1
                dept_key = c.department_name or "Geral / Não atribuído"
                by_department[dept_key] = by_department.get(dept_key, 0) + 1

            avg_resolution_days = (
                round(sum(resolution_days_list) / len(resolution_days_list), 1)
                if resolution_days_list
                else 0.0
            )

            return ConflictDashboardResponse(
                total_cases=total_cases,
                open_cases=open_cases,
                in_mediation=in_mediation,
                in_investigation=in_investigation,
                resolved=resolved,
                high_retaliation_risk=high_retaliation_risk,
                avg_resolution_days=avg_resolution_days,
                by_type=by_type,
                by_severity=by_severity,
                by_department=by_department,
            )
