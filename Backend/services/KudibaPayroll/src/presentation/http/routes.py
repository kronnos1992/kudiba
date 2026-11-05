import inspect
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from src.application.dto import (
    AbsenceResponse,
    AddSalaryComponentRequest,
    AttendanceResponse,
    CalculatePayrollPeriodRequest,
    ContractResponse,
    CreateAbsenceRequest,
    CreateAttendanceRequest,
    CreateContractRequest,
    CreateDepartmentRequest,
    CreateEmployeeRequest,
    CreateJobPositionRequest,
    CreateVacationRequest,
    DepartmentResponse,
    EmployeeResponse,
    JobPositionResponse,
    OpenPayrollPeriodRequest,
    PayrollDashboardSummaryResponse,
    PayrollPeriodResponse,
    PayslipResponse,
    PeriodSummaryResponse,
    Ps2ExportResponse,
    SalaryComponentResponse,
    TerminateEmployeeRequest,
    UpdateEmployeeRequest,
    VacationBalanceResponse,
    VacationDecisionRequest,
    VacationResponse,
    AddParticipantRequest,
    ConflictActionResponse,
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
from src.presentation.http.dependencies import get_app_state, get_current_tenant_id


def _get_val(obj, key, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def extract_actor(request: Request) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    actor_id = request.headers.get("X-User-ID")
    actor_name = request.headers.get("X-User-Name")
    ip_addr = request.headers.get("X-Forwarded-For")
    if ip_addr:
        ip_addr = ip_addr.split(",")[0].strip()
    elif request.client:
        ip_addr = request.client.host
    return actor_id, actor_name, ip_addr


async def record_audit(
    app_state,
    tenant_id: UUID,
    module: str,
    action: str,
    entity_type: str,
    entity_id: str,
    document_reference: Optional[str] = None,
    request: Optional[Request] = None,
    details: Optional[dict] = None,
):
    actor_id, actor_name, ip_addr = (None, None, None)
    if request:
        actor_id, actor_name, ip_addr = extract_actor(request)
    if hasattr(app_state, "audit_repo") and app_state.audit_repo:
        coro = app_state.audit_repo.record_event(
            tenant_id=tenant_id,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            document_reference=document_reference,
            actor_user_id=actor_id,
            actor_name=actor_name,
            ip_address=ip_addr,
            details=details or {},
        )
        if inspect.isawaitable(coro):
            await coro


def create_payroll_router() -> APIRouter:
    router = APIRouter()

    # =========================================================================
    # DEPARTAMENTOS & CARGOS (ORGANIZATION)
    # =========================================================================
    @router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED, tags=["Organização"])
    async def create_department(
        req: CreateDepartmentRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.create_department.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="CRIACAO_DEPARTAMENTO",
            entity_type="DEPARTMENT",
            entity_id=str(res.id),
            document_reference=res.code,
            request=request,
            details={"name": res.name, "code": res.code},
        )
        return res

    @router.get("/departments", response_model=List[DepartmentResponse], tags=["Organização"])
    async def list_departments(
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_departments.execute(tenant_id)

    @router.post("/job-positions", response_model=JobPositionResponse, status_code=status.HTTP_201_CREATED, tags=["Organização"])
    async def create_job_position(
        req: CreateJobPositionRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.create_job_position.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="CRIACAO_CARGO",
            entity_type="JOB_POSITION",
            entity_id=str(res.id),
            document_reference=res.code,
            request=request,
            details={"name": res.name, "code": res.code},
        )
        return res

    @router.get("/job-positions", response_model=List[JobPositionResponse], tags=["Organização"])
    async def list_job_positions(
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_job_positions.execute(tenant_id)

    # =========================================================================
    # COLABORADORES (EMPLOYEES)
    # =========================================================================
    @router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, tags=["Colaboradores"])
    async def register_employee(
        req: CreateEmployeeRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.register_employee.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ADMISSAO_COLABORADOR",
            entity_type="EMPLOYEE",
            entity_id=str(res.id),
            document_reference=res.employee_number,
            request=request,
            details={"name": f"{res.first_name} {res.last_name}", "nif": res.nif},
        )
        return res

    @router.get("/employees", response_model=List[EmployeeResponse], tags=["Colaboradores"])
    async def list_employees(
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_employees.execute(tenant_id)

    @router.get("/employees/{employee_id}", response_model=EmployeeResponse, tags=["Colaboradores"])
    async def get_employee(
        employee_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_employee.execute(tenant_id, employee_id)

    @router.put("/employees/{employee_id}", response_model=EmployeeResponse, tags=["Colaboradores"])
    async def update_employee(
        employee_id: UUID,
        req: UpdateEmployeeRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.update_employee.execute(tenant_id, employee_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ATUALIZACAO_COLABORADOR",
            entity_type="EMPLOYEE",
            entity_id=str(employee_id),
            document_reference=res.employee_number,
            request=request,
            details={"name": f"{res.first_name} {res.last_name}"},
        )
        return res

    @router.post("/employees/{employee_id}/terminate", response_model=EmployeeResponse, tags=["Colaboradores"])
    async def terminate_employee(
        employee_id: UUID,
        req: TerminateEmployeeRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.terminate_employee.execute(tenant_id, employee_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="DEMISSAO_COLABORADOR",
            entity_type="EMPLOYEE",
            entity_id=str(employee_id),
            document_reference=res.employee_number,
            request=request,
            details={"reason": req.reason},
        )
        return res

    @router.get("/employees/{employee_id}/vacation-balance", response_model=VacationBalanceResponse, tags=["Férias & Assiduidade"])
    async def get_vacation_balance(
        employee_id: UUID,
        year: int = Query(..., ge=2020, le=2100),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_vacation_balance.execute(tenant_id, employee_id, year)

    # =========================================================================
    # CONTRATOS & COMPONENTES SALARIAIS (CONTRACTS)
    # =========================================================================
    @router.post("/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED, tags=["Contratos"])
    async def create_contract(
        req: CreateContractRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.create_contract.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="CRIACAO_CONTRATO_TRABALHO",
            entity_type="CONTRACT",
            entity_id=str(res.id),
            document_reference=f"CTR-{res.id}",
            request=request,
            details={"employee_id": str(res.employee_id), "contract_type": str(res.contract_type), "base_salary": str(res.base_salary)},
        )
        return res

    @router.get("/contracts", response_model=List[ContractResponse], tags=["Contratos"])
    async def list_contracts(
        employee_id: Optional[UUID] = Query(None),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_contracts.execute(tenant_id, employee_id=employee_id)

    @router.get("/contracts/{contract_id}", response_model=ContractResponse, tags=["Contratos"])
    async def get_contract(
        contract_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_contract.execute(tenant_id, contract_id)

    @router.post("/contracts/{contract_id}/components", response_model=SalaryComponentResponse, status_code=status.HTTP_201_CREATED, tags=["Contratos"])
    async def add_salary_component(
        contract_id: UUID,
        req: AddSalaryComponentRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.add_salary_component.execute(tenant_id, contract_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ADICAO_COMPONENTE_SALARIAL",
            entity_type="SALARY_COMPONENT",
            entity_id=str(res.id),
            document_reference=f"CTR-{contract_id}",
            request=request,
            details={"name": res.name, "amount": str(res.amount), "component_type": str(res.component_type)},
        )
        return res

    # =========================================================================
    # FÉRIAS & ASSIDUIDADE (HR)
    # =========================================================================
    @router.post("/vacations", response_model=VacationResponse, status_code=status.HTTP_201_CREATED, tags=["Férias & Assiduidade"])
    async def request_vacation(
        req: CreateVacationRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.request_vacation.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="SOLICITACAO_FERIAS",
            entity_type="VACATION",
            entity_id=str(res.id),
            document_reference=f"VAC-{res.id}",
            request=request,
            details={"employee_id": str(res.employee_id), "days": str(res.days)},
        )
        return res

    @router.get("/vacations", response_model=List[VacationResponse], tags=["Férias & Assiduidade"])
    async def list_vacations(
        employee_id: Optional[UUID] = Query(None),
        vacation_status: Optional[str] = Query(None, alias="status"),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_vacations.execute(tenant_id, employee_id=employee_id, status=vacation_status)

    @router.post("/vacations/{vacation_id}/approve", response_model=VacationResponse, tags=["Férias & Assiduidade"])
    async def approve_vacation(
        vacation_id: UUID,
        req: VacationDecisionRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.decide_vacation.execute(tenant_id, vacation_id, req, approve=True)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="APROVACAO_FERIAS",
            entity_type="VACATION",
            entity_id=str(vacation_id),
            document_reference=f"VAC-{vacation_id}",
            request=request,
            details={"status": "APPROVED", "notes": req.notes},
        )
        return res

    @router.post("/vacations/{vacation_id}/reject", response_model=VacationResponse, tags=["Férias & Assiduidade"])
    async def reject_vacation(
        vacation_id: UUID,
        req: VacationDecisionRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.decide_vacation.execute(tenant_id, vacation_id, req, approve=False)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="REJEICAO_FERIAS",
            entity_type="VACATION",
            entity_id=str(vacation_id),
            document_reference=f"VAC-{vacation_id}",
            request=request,
            details={"status": "REJECTED", "notes": req.notes},
        )
        return res

    @router.post("/absences", response_model=AbsenceResponse, status_code=status.HTTP_201_CREATED, tags=["Férias & Assiduidade"])
    async def record_absence(
        req: CreateAbsenceRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.record_absence.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="REGISTO_AUSENCIA",
            entity_type="ABSENCE",
            entity_id=str(res.id),
            document_reference=f"ABS-{res.id}",
            request=request,
            details={"employee_id": str(res.employee_id), "reason": res.reason},
        )
        return res

    @router.get("/absences", response_model=List[AbsenceResponse], tags=["Férias & Assiduidade"])
    async def list_absences(
        employee_id: Optional[UUID] = Query(None),
        date_from: Optional[date] = Query(None),
        date_to: Optional[date] = Query(None),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_absences.execute(
            tenant_id, employee_id=employee_id, date_from=date_from, date_to=date_to
        )

    @router.post("/attendance", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED, tags=["Férias & Assiduidade"])
    async def record_attendance(
        req: CreateAttendanceRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.record_attendance.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="REGISTO_PICAGEM_PONTO",
            entity_type="ATTENDANCE",
            entity_id=str(res.id),
            document_reference=f"ATT-{res.id}",
            request=request,
            details={"employee_id": str(res.employee_id), "direction": str(res.direction)},
        )
        return res

    @router.get("/attendance", response_model=List[AttendanceResponse], tags=["Férias & Assiduidade"])
    async def list_attendance(
        employee_id: Optional[UUID] = Query(None),
        date_from: Optional[date] = Query(None),
        date_to: Optional[date] = Query(None),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_attendance.execute(
            tenant_id, employee_id=employee_id, date_from=date_from, date_to=date_to
        )

    # =========================================================================
    # PERIODOS DE PROCESSAMENTO SALARIAL (PAYROLL PERIODS)
    # =========================================================================
    @router.post("/periods", response_model=PayrollPeriodResponse, status_code=status.HTTP_201_CREATED, tags=["Processamento Salarial"])
    async def open_period(
        req: OpenPayrollPeriodRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.open_payroll_period.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ABERTURA_PERIODO_PROCESSAMENTO",
            entity_type="PAYROLL_PERIOD",
            entity_id=str(res.id),
            document_reference=f"PRD-{res.year}-{res.month:02d}",
            request=request,
            details={"year": res.year, "month": res.month},
        )
        return res

    @router.get("/periods", response_model=List[PayrollPeriodResponse], tags=["Processamento Salarial"])
    async def list_periods(
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_payroll_periods.execute(tenant_id)

    @router.get("/periods/{period_id}", response_model=PayrollPeriodResponse, tags=["Processamento Salarial"])
    async def get_period(
        period_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_payroll_period.execute(tenant_id, period_id)

    @router.get("/periods/{period_id}/summary", response_model=PeriodSummaryResponse, tags=["Processamento Salarial"])
    async def get_period_summary(
        period_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_period_summary.execute(tenant_id, period_id)

    @router.post("/periods/{period_id}/calculate", response_model=PayrollPeriodResponse, tags=["Processamento Salarial"])
    async def calculate_period(
        period_id: UUID,
        req: CalculatePayrollPeriodRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.calculate_payroll_period.execute(tenant_id, period_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="CALCULO_FOLHA_SALARIAL",
            entity_type="PAYROLL_PERIOD",
            entity_id=str(period_id),
            document_reference=f"PRD-{res.year}-{res.month:02d}",
            request=request,
            details={"period_id": str(period_id)},
        )
        return res

    @router.post("/periods/{period_id}/close", response_model=PayrollPeriodResponse, tags=["Processamento Salarial"])
    async def close_period(
        period_id: UUID,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.close_payroll_period.execute(tenant_id, period_id)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="FECHO_PERIODO_PROCESSAMENTO",
            entity_type="PAYROLL_PERIOD",
            entity_id=str(period_id),
            document_reference=f"PRD-{res.year}-{res.month:02d}",
            request=request,
            details={"period_id": str(period_id)},
        )
        return res

    @router.get("/periods/{period_id}/payslips", response_model=List[PayslipResponse], tags=["Processamento Salarial"])
    async def list_period_payslips(
        period_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.list_payslips.execute(tenant_id, period_id)

    @router.get("/periods/{period_id}/ps2", response_model=Ps2ExportResponse, tags=["Remessa Bancária PS2"])
    async def export_ps2_file(
        period_id: UUID,
        company_name: str = Query("Kudiba Solucoes Tecnologicas Lda", max_length=100),
        company_nif: str = Query("5412345678", max_length=20),
        company_iban: str = Query("AO06004000000010002000301", max_length=34),
        as_download: bool = Query(False),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.export_ps2.execute(
            tenant_id=tenant_id,
            period_id=period_id,
            company_name=company_name,
            company_nif=company_nif,
            company_iban=company_iban,
        )
        if as_download:
            return Response(
                content=res.content,
                media_type="text/plain; charset=iso-8859-1",
                headers={"Content-Disposition": f'attachment; filename="{res.filename}"'},
            )
        return res

    # =========================================================================
    # RECIBOS INDIVIDUAIS (PAYSLIPS)
    # =========================================================================
    @router.get("/payslips/{payslip_id}", response_model=PayslipResponse, tags=["Processamento Salarial"])
    async def get_payslip(
        payslip_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_payslip.execute(tenant_id, payslip_id)

    @router.post("/payslips/{payslip_id}/pay", response_model=PayslipResponse, tags=["Processamento Salarial"])
    async def pay_payslip(
        payslip_id: UUID,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.mark_payslip_paid.execute(tenant_id, payslip_id)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="PAGAMENTO_RECIBO_VENCIMENTO",
            entity_type="PAYSLIP",
            entity_id=str(payslip_id),
            document_reference=f"REC-{payslip_id}",
            request=request,
            details={"payslip_id": str(payslip_id)},
        )
        return res

    @router.get("/payslips/{payslip_id}/pdf", tags=["Processamento Salarial"])
    async def download_payslip_pdf(
        payslip_id: UUID,
        company_name: str = Query("Kudiba Solucoes Tecnologicas Lda", max_length=100),
        company_nif: str = Query("5412345678", max_length=20),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        content, filename = await app_state.generate_payslip_pdf.execute(
            tenant_id=tenant_id,
            payslip_id=payslip_id,
            company_name=company_name,
            company_nif=company_nif,
        )
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # =========================================================================
    # PAINEL EXECUTIVO (DASHBOARD)
    # =========================================================================
    @router.get(
        "/dashboard/summary",
        response_model=PayrollDashboardSummaryResponse,
        tags=["Painel Executivo"],
    )
    async def get_dashboard_summary(
        year: Optional[int] = Query(None, ge=2020, le=2100),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.get_dashboard_summary.execute(tenant_id, year)

    # =========================================================================
    # GESTÃO DE CONFLITOS & MEDIAÇÃO LABORAL
    # =========================================================================
    @router.get(
        "/conflicts/dashboard",
        response_model=ConflictDashboardResponse,
        tags=["Gestão de Conflitos"],
    )
    async def get_conflict_dashboard(
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.conflict_repo.get_dashboard(tenant_id)

    @router.get(
        "/conflicts",
        response_model=List[ConflictCaseSummaryResponse],
        tags=["Gestão de Conflitos"],
    )
    async def list_conflict_cases(
        status: Optional[str] = Query(None),
        severity: Optional[str] = Query(None),
        conflict_type: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.conflict_repo.list_cases(
            tenant_id=tenant_id,
            status=status,
            severity=severity,
            conflict_type=conflict_type,
            search=search,
        )

    @router.post(
        "/conflicts",
        response_model=ConflictCaseDetailResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Gestão de Conflitos"],
    )
    async def create_conflict_case(
        req: CreateConflictCaseRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.create_case(tenant_id, req)
        res_id = res.get("id") if isinstance(res, dict) else getattr(res, "id", None)
        ref_code = res.get("reference_code") if isinstance(res, dict) else getattr(res, "reference_code", None)
        res_title = res.get("title") if isinstance(res, dict) else getattr(res, "title", None)
        res_type = res.get("conflict_type") if isinstance(res, dict) else getattr(res, "conflict_type", None)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="CRIACAO_CASO_CONFLITO",
            entity_type="CONFLICT_CASE",
            entity_id=str(res_id) if res_id else None,
            document_reference=ref_code,
            request=request,
            details={"title": res_title, "conflict_type": res_type},
        )
        return res

    @router.get(
        "/conflicts/{case_id}",
        response_model=ConflictCaseDetailResponse,
        tags=["Gestão de Conflitos"],
    )
    async def get_conflict_case(
        case_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        case = await app_state.conflict_repo.get_case_by_id(tenant_id, case_id)
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Caso de conflito '{case_id}' não encontrado.",
            )
        return case

    @router.patch(
        "/conflicts/{case_id}/status",
        response_model=ConflictCaseDetailResponse,
        tags=["Gestão de Conflitos"],
    )
    async def update_conflict_status(
        case_id: UUID,
        req: UpdateConflictStatusRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.update_status(tenant_id, case_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ATUALIZACAO_ESTADO_CONFLITO",
            entity_type="CONFLICT_CASE",
            entity_id=str(case_id),
            document_reference=_get_val(res, "reference_code"),
            request=request,
            details={"status": req.status},
        )
        return res

    @router.post(
        "/conflicts/{case_id}/triage",
        response_model=ConflictCaseDetailResponse,
        tags=["Gestão de Conflitos"],
    )
    async def triage_conflict_case(
        case_id: UUID,
        req: TriageConflictCaseRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.triage_case(tenant_id, case_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="TRIAGEM_CASO_CONFLITO",
            entity_type="CONFLICT_CASE",
            entity_id=str(case_id),
            document_reference=_get_val(res, "reference_code"),
            request=request,
            details={"severity": req.severity, "route": req.resolution_route},
        )
        return res

    @router.post(
        "/conflicts/{case_id}/participants",
        response_model=ConflictParticipantResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Gestão de Conflitos"],
    )
    async def add_conflict_participant(
        case_id: UUID,
        req: AddParticipantRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.add_participant(tenant_id, case_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ADICAO_PARTICIPANTE_CONFLITO",
            entity_type="CONFLICT_PARTICIPANT",
            entity_id=str(_get_val(res, "id")),
            document_reference=f"CON-{case_id}",
            request=request,
            details={"name": _get_val(res, "name"), "role": _get_val(res, "role")},
        )
        return res

    @router.post(
        "/conflicts/{case_id}/meetings",
        response_model=ConflictMeetingResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Gestão de Conflitos"],
    )
    async def create_conflict_meeting(
        case_id: UUID,
        req: CreateMeetingRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.create_meeting(tenant_id, case_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="AGENDAMENTO_REUNIAO_CONFLITO",
            entity_type="CONFLICT_MEETING",
            entity_id=str(_get_val(res, "id")),
            document_reference=f"CON-{case_id}",
            request=request,
            details={"meeting_type": _get_val(res, "meeting_type"), "conducted_by": _get_val(res, "conducted_by")},
        )
        return res

    @router.post(
        "/conflicts/{case_id}/actions",
        response_model=ConflictActionResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Gestão de Conflitos"],
    )
    async def create_conflict_action(
        case_id: UUID,
        req: CreateActionRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.create_action(tenant_id, case_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="CRIACAO_ACAO_CONFLITO",
            entity_type="CONFLICT_ACTION",
            entity_id=str(_get_val(res, "id")),
            document_reference=f"CON-{case_id}",
            request=request,
            details={"title": _get_val(res, "title"), "assigned_to": _get_val(res, "assigned_to")},
        )
        return res

    @router.patch(
        "/conflicts/actions/{action_id}",
        response_model=ConflictActionResponse,
        tags=["Gestão de Conflitos"],
    )
    async def update_conflict_action(
        action_id: UUID,
        req: UpdateActionRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.update_action(tenant_id, action_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="ATUALIZACAO_ACAO_CONFLITO",
            entity_type="CONFLICT_ACTION",
            entity_id=str(action_id),
            document_reference=f"ACT-{action_id}",
            request=request,
            details={"status": req.status},
        )
        return res

    @router.post(
        "/conflicts/{case_id}/follow-ups",
        response_model=ConflictFollowUpResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Gestão de Conflitos"],
    )
    async def create_conflict_follow_up(
        case_id: UUID,
        req: CreateFollowUpRequest,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        res = await app_state.conflict_repo.create_follow_up(tenant_id, case_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="PAYROLL",
            action="REGISTO_SEGUIMENTO_CONFLITO",
            entity_type="CONFLICT_FOLLOW_UP",
            entity_id=str(_get_val(res, "id")),
            document_reference=f"CON-{case_id}",
            request=request,
            details={"is_stable": _get_val(res, "is_stable")},
        )
        return res

    @router.get("/system-audit-trail", tags=["Auditoria"])
    async def get_system_audit_trail(
        tenant_id: UUID = Depends(get_current_tenant_id),
        module: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        app_state=Depends(get_app_state),
    ):
        items = await app_state.audit_repo.list_events(
            tenant_id=tenant_id,
            module=module,
            action=action,
            limit=limit,
            offset=offset,
        )
        total = await app_state.audit_repo.count_events(
            tenant_id=tenant_id,
            module=module,
            action=action,
        )
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    return router
