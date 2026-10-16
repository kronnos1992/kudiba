from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from src.domain.entities.contract import Contract, SalaryComponent
from src.domain.value_objects.enums import ContractStatus


class ContractRepository(ABC):
    @abstractmethod
    async def get_by_id(self, tenant_id: UUID, contract_id: UUID) -> Optional[Contract]:
        pass

    @abstractmethod
    async def get_active_by_employee(self, tenant_id: UUID, employee_id: UUID) -> Optional[Contract]:
        pass

    @abstractmethod
    async def list_active_contracts(self, tenant_id: UUID) -> List[Contract]:
        pass

    @abstractmethod
    async def list_contracts(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        status: Optional[ContractStatus] = None,
    ) -> List[Contract]:
        pass

    @abstractmethod
    async def save(self, contract: Contract) -> None:
        pass

    @abstractmethod
    async def add_component(self, component: SalaryComponent) -> None:
        pass
