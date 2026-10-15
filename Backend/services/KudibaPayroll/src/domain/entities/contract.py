from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4
from src.domain.value_objects.enums import ContractType, ContractStatus, ComponentType


@dataclass
class SalaryComponent:
    id: UUID
    tenant_id: UUID
    contract_id: UUID
    component_type: ComponentType
    name: str
    amount: Decimal
    is_taxable_irt: bool = True
    is_taxable_inss: bool = True
    is_active: bool = True
    created_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        contract_id: UUID,
        component_type: ComponentType,
        name: str,
        amount: Decimal,
        is_taxable_irt: bool = True,
        is_taxable_inss: bool = True,
    ) -> "SalaryComponent":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            contract_id=contract_id,
            component_type=component_type,
            name=name,
            amount=amount,
            is_taxable_irt=is_taxable_irt,
            is_taxable_inss=is_taxable_inss,
            is_active=True,
        )


@dataclass
class Contract:
    id: UUID
    tenant_id: UUID
    employee_id: UUID
    contract_type: ContractType
    start_date: date
    base_salary: Decimal
    status: ContractStatus
    job_position_id: Optional[UUID] = None
    end_date: Optional[date] = None
    components: List[SalaryComponent] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        employee_id: UUID,
        contract_type: ContractType,
        start_date: date,
        base_salary: Decimal,
        job_position_id: Optional[UUID] = None,
        end_date: Optional[date] = None,
    ) -> "Contract":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            employee_id=employee_id,
            contract_type=contract_type,
            start_date=start_date,
            base_salary=base_salary,
            status=ContractStatus.ACTIVE,
            job_position_id=job_position_id,
            end_date=end_date,
            components=[],
        )

    def suspend(self) -> None:
        self.status = ContractStatus.SUSPENDED

    def terminate(self, end_date: date) -> None:
        self.status = ContractStatus.TERMINATED
        self.end_date = end_date
