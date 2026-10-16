from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from src.domain.entities.organization import Department, JobPosition


class OrganizationRepository(ABC):
    @abstractmethod
    async def get_department_by_id(self, tenant_id: UUID, department_id: UUID) -> Optional[Department]:
        pass

    @abstractmethod
    async def get_department_by_code(self, tenant_id: UUID, code: str) -> Optional[Department]:
        pass

    @abstractmethod
    async def list_departments(self, tenant_id: UUID) -> List[Department]:
        pass

    @abstractmethod
    async def save_department(self, department: Department) -> None:
        pass

    @abstractmethod
    async def get_job_position_by_id(self, tenant_id: UUID, job_position_id: UUID) -> Optional[JobPosition]:
        pass

    @abstractmethod
    async def get_job_position_by_code(self, tenant_id: UUID, code: str) -> Optional[JobPosition]:
        pass

    @abstractmethod
    async def list_job_positions(self, tenant_id: UUID) -> List[JobPosition]:
        pass

    @abstractmethod
    async def save_job_position(self, job_position: JobPosition) -> None:
        pass
