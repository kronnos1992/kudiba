from uuid import UUID
from src.application.dto import CreateDepartmentRequest, CreateJobPositionRequest
from src.domain.entities.organization import Department, JobPosition
from src.domain.error import ConflictError, EntityNotFoundError
from src.domain.ports.organization_repository import OrganizationRepository


class CreateDepartmentUseCase:
    def __init__(self, org_repo: OrganizationRepository):
        self.org_repo = org_repo

    async def execute(self, tenant_id: UUID, req: CreateDepartmentRequest) -> Department:
        existing = await self.org_repo.get_department_by_code(tenant_id, req.code)
        if existing:
            raise ConflictError(f"Já existe um departamento com o código '{req.code}'.")

        department = Department.create(
            tenant_id=tenant_id,
            code=req.code,
            name=req.name,
            description=req.description,
        )
        await self.org_repo.save_department(department)
        return department


class CreateJobPositionUseCase:
    def __init__(self, org_repo: OrganizationRepository):
        self.org_repo = org_repo

    async def execute(self, tenant_id: UUID, req: CreateJobPositionRequest) -> JobPosition:
        existing = await self.org_repo.get_job_position_by_code(tenant_id, req.code)
        if existing:
            raise ConflictError(f"Já existe um cargo com o código '{req.code}'.")

        if req.department_id:
            department = await self.org_repo.get_department_by_id(tenant_id, req.department_id)
            if not department:
                raise EntityNotFoundError("Departamento", str(req.department_id))

        job_position = JobPosition.create(
            tenant_id=tenant_id,
            code=req.code,
            title=req.title,
            department_id=req.department_id,
            base_salary_min=req.base_salary_min,
            base_salary_max=req.base_salary_max,
        )
        await self.org_repo.save_job_position(job_position)
        return job_position
