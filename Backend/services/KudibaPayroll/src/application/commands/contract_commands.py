from uuid import UUID
from src.application.dto import CreateContractRequest, AddSalaryComponentRequest
from src.domain.entities.contract import Contract, SalaryComponent
from src.domain.error import EntityNotFoundError
from src.domain.ports.contract_repository import ContractRepository
from src.domain.ports.employee_repository import EmployeeRepository


class CreateContractUseCase:
    def __init__(self, contract_repo: ContractRepository, employee_repo: EmployeeRepository):
        self.contract_repo = contract_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, req: CreateContractRequest) -> Contract:
        employee = await self.employee_repo.get_by_id(tenant_id, req.employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(req.employee_id))

        contract = Contract.create(
            tenant_id=tenant_id,
            employee_id=req.employee_id,
            contract_type=req.contract_type,
            start_date=req.start_date,
            base_salary=req.base_salary,
            job_position_id=req.job_position_id,
            end_date=req.end_date,
        )

        for comp_req in req.components:
            comp = SalaryComponent.create(
                tenant_id=tenant_id,
                contract_id=contract.id,
                component_type=comp_req.component_type,
                name=comp_req.name,
                amount=comp_req.amount,
                is_taxable_irt=comp_req.is_taxable_irt,
                is_taxable_inss=comp_req.is_taxable_inss,
            )
            contract.components.append(comp)

        await self.contract_repo.save(contract)
        return contract


class AddSalaryComponentUseCase:
    def __init__(self, contract_repo: ContractRepository):
        self.contract_repo = contract_repo

    async def execute(self, tenant_id: UUID, contract_id: UUID, req: AddSalaryComponentRequest) -> SalaryComponent:
        contract = await self.contract_repo.get_by_id(tenant_id, contract_id)
        if not contract:
            raise EntityNotFoundError("Contrato", str(contract_id))

        component = SalaryComponent.create(
            tenant_id=tenant_id,
            contract_id=contract_id,
            component_type=req.component_type,
            name=req.name,
            amount=req.amount,
            is_taxable_irt=req.is_taxable_irt,
            is_taxable_inss=req.is_taxable_inss,
        )
        await self.contract_repo.add_component(component)
        return component
