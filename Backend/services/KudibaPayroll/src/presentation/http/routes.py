from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response, status
from src.application.dto import (
    AddSalaryComponentRequest,
    CalculatePayrollPeriodRequest,
    ContractResponse,
    CreateContractRequest,
    CreateEmployeeRequest,
    EmployeeResponse,
    OpenPayrollPeriodRequest,
    PayrollPeriodResponse,
    PayslipResponse,
    Ps2ExportResponse,
    SalaryComponentResponse,
    TerminateEmployeeRequest,
)
from src.presentation.http.dependencies import get_app_state, get_current_tenant_id


def create_payroll_router() -> APIRouter:
    router = APIRouter()

    # =========================================================================
    # COLABORADORES (EMPLOYEES)
    # =========================================================================
    @router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, tags=["Colaboradores"])
    async def register_employee(
        req: CreateEmployeeRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.register_employee.execute(tenant_id, req)

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

    @router.post("/employees/{employee_id}/terminate", response_model=EmployeeResponse, tags=["Colaboradores"])
    async def terminate_employee(
        employee_id: UUID,
        req: TerminateEmployeeRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.terminate_employee.execute(tenant_id, employee_id, req)

    # =========================================================================
    # CONTRATOS & COMPONENTES SALARIAIS (CONTRACTS)
    # =========================================================================
    @router.post("/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED, tags=["Contratos"])
    async def create_contract(
        req: CreateContractRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.create_contract.execute(tenant_id, req)

    @router.post("/contracts/{contract_id}/components", response_model=SalaryComponentResponse, status_code=status.HTTP_201_CREATED, tags=["Contratos"])
    async def add_salary_component(
        contract_id: UUID,
        req: AddSalaryComponentRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.add_salary_component.execute(tenant_id, contract_id, req)

    # =========================================================================
    # PERIODOS DE PROCESSAMENTO SALARIAL (PAYROLL PERIODS)
    # =========================================================================
    @router.post("/periods", response_model=PayrollPeriodResponse, status_code=status.HTTP_201_CREATED, tags=["Processamento Salarial"])
    async def open_period(
        req: OpenPayrollPeriodRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.open_payroll_period.execute(tenant_id, req)

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

    @router.post("/periods/{period_id}/calculate", response_model=PayrollPeriodResponse, tags=["Processamento Salarial"])
    async def calculate_period(
        period_id: UUID,
        req: CalculatePayrollPeriodRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.calculate_payroll_period.execute(tenant_id, period_id, req)

    @router.post("/periods/{period_id}/close", response_model=PayrollPeriodResponse, tags=["Processamento Salarial"])
    async def close_period(
        period_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        return await app_state.close_payroll_period.execute(tenant_id, period_id)

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

    return router
