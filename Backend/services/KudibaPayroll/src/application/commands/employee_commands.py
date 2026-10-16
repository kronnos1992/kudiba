from uuid import UUID
from src.application.dto import CreateEmployeeRequest, TerminateEmployeeRequest, UpdateEmployeeRequest
from src.domain.entities.employee import Employee
from src.domain.error import ConflictError, EntityNotFoundError
from src.domain.ports.employee_repository import EmployeeRepository


class RegisterEmployeeUseCase:
    def __init__(self, employee_repo: EmployeeRepository):
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, req: CreateEmployeeRequest) -> Employee:
        existing_code = await self.employee_repo.get_by_code(tenant_id, req.code)
        if existing_code:
            raise ConflictError(f"Já existe um colaborador com o código '{req.code}'.")

        existing_nif = await self.employee_repo.get_by_nif(tenant_id, req.nif)
        if existing_nif:
            raise ConflictError(f"Já existe um colaborador com o NIF '{req.nif}'.")

        employee = Employee.create(
            tenant_id=tenant_id,
            code=req.code,
            full_name=req.full_name,
            nif=req.nif,
            identity_card_number=req.identity_card_number,
            iban=req.iban,
            hire_date=req.hire_date,
            inss_number=req.inss_number,
            birth_date=req.birth_date,
            gender=req.gender,
            marital_status=req.marital_status,
            dependents_count=req.dependents_count,
            email=req.email,
            phone=req.phone,
            bank_code=req.bank_code,
            address=req.address,
        )
        await self.employee_repo.save(employee)
        return employee


class TerminateEmployeeUseCase:
    def __init__(self, employee_repo: EmployeeRepository):
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, employee_id: UUID, req: TerminateEmployeeRequest) -> Employee:
        employee = await self.employee_repo.get_by_id(tenant_id, employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(employee_id))

        employee.terminate(req.termination_date)
        await self.employee_repo.save(employee)
        return employee


class UpdateEmployeeUseCase:
    def __init__(self, employee_repo: EmployeeRepository):
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, employee_id: UUID, req: UpdateEmployeeRequest) -> Employee:
        employee = await self.employee_repo.get_by_id(tenant_id, employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(employee_id))

        if req.identity_card_number and req.identity_card_number != employee.identity_card_number:
            existing = await self.employee_repo.get_by_identity_card(tenant_id, req.identity_card_number)
            if existing:
                raise ConflictError(
                    f"Já existe um colaborador com o documento de identificação '{req.identity_card_number}'."
                )

        employee.update(
            full_name=req.full_name,
            identity_card_number=req.identity_card_number,
            iban=req.iban,
            inss_number=req.inss_number,
            birth_date=req.birth_date,
            gender=req.gender,
            marital_status=req.marital_status,
            dependents_count=req.dependents_count,
            email=req.email,
            phone=req.phone,
            bank_code=req.bank_code,
            address=req.address,
        )
        await self.employee_repo.save(employee)
        return employee
