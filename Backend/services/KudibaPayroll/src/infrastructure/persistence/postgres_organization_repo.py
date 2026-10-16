from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.organization import Department, JobPosition
from src.domain.ports.organization_repository import OrganizationRepository
from src.infrastructure.persistence.models import DepartmentModel, JobPositionModel


class PostgresOrganizationRepository(OrganizationRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    @staticmethod
    def _to_department(model: DepartmentModel) -> Department:
        return Department(
            id=model.id,
            tenant_id=model.tenant_id,
            code=model.code,
            name=model.name,
            description=model.description,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_job_position(model: JobPositionModel) -> JobPosition:
        return JobPosition(
            id=model.id,
            tenant_id=model.tenant_id,
            code=model.code,
            title=model.title,
            department_id=model.department_id,
            base_salary_min=model.base_salary_min,
            base_salary_max=model.base_salary_max,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_department_by_id(self, tenant_id: UUID, department_id: UUID) -> Optional[Department]:
        async with self.session_factory() as session:
            stmt = select(DepartmentModel).where(
                DepartmentModel.tenant_id == tenant_id,
                DepartmentModel.id == department_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_department(model) if model else None

    async def get_department_by_code(self, tenant_id: UUID, code: str) -> Optional[Department]:
        async with self.session_factory() as session:
            stmt = select(DepartmentModel).where(
                DepartmentModel.tenant_id == tenant_id,
                DepartmentModel.code == code,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_department(model) if model else None

    async def list_departments(self, tenant_id: UUID) -> List[Department]:
        async with self.session_factory() as session:
            stmt = (
                select(DepartmentModel)
                .where(DepartmentModel.tenant_id == tenant_id)
                .order_by(DepartmentModel.code)
            )
            res = await session.execute(stmt)
            return [self._to_department(m) for m in res.scalars().all()]

    async def save_department(self, department: Department) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                model = DepartmentModel(
                    id=department.id,
                    tenant_id=department.tenant_id,
                    code=department.code,
                    name=department.name,
                    description=department.description,
                )
                session.add(model)

    async def get_job_position_by_id(self, tenant_id: UUID, job_position_id: UUID) -> Optional[JobPosition]:
        async with self.session_factory() as session:
            stmt = select(JobPositionModel).where(
                JobPositionModel.tenant_id == tenant_id,
                JobPositionModel.id == job_position_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_job_position(model) if model else None

    async def get_job_position_by_code(self, tenant_id: UUID, code: str) -> Optional[JobPosition]:
        async with self.session_factory() as session:
            stmt = select(JobPositionModel).where(
                JobPositionModel.tenant_id == tenant_id,
                JobPositionModel.code == code,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_job_position(model) if model else None

    async def list_job_positions(self, tenant_id: UUID) -> List[JobPosition]:
        async with self.session_factory() as session:
            stmt = (
                select(JobPositionModel)
                .where(JobPositionModel.tenant_id == tenant_id)
                .order_by(JobPositionModel.code)
            )
            res = await session.execute(stmt)
            return [self._to_job_position(m) for m in res.scalars().all()]

    async def save_job_position(self, job_position: JobPosition) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                model = JobPositionModel(
                    id=job_position.id,
                    tenant_id=job_position.tenant_id,
                    department_id=job_position.department_id,
                    code=job_position.code,
                    title=job_position.title,
                    base_salary_min=job_position.base_salary_min,
                    base_salary_max=job_position.base_salary_max,
                )
                session.add(model)
