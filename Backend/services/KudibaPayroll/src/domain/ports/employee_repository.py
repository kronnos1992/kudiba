from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from src.domain.entities.employee import Employee


class EmployeeRepository(ABC):
    @abstractmethod
    async def get_by_id(self, tenant_id: UUID, employee_id: UUID) -> Optional[Employee]:
        pass

    @abstractmethod
    async def get_by_code(self, tenant_id: UUID, code: str) -> Optional[Employee]:
        pass

    @abstractmethod
    async def get_by_nif(self, tenant_id: UUID, nif: str) -> Optional[Employee]:
        pass

    @abstractmethod
    async def get_by_identity_card(self, tenant_id: UUID, identity_card_number: str) -> Optional[Employee]:
        pass

    @abstractmethod
    async def list_active(self, tenant_id: UUID) -> List[Employee]:
        pass

    @abstractmethod
    async def count_by_status(self, tenant_id: UUID) -> dict[str, int]:
        pass

    @abstractmethod
    async def save(self, employee: Employee) -> None:
        pass
