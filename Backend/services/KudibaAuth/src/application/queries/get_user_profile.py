import uuid
from typing import List
from src.application.dto import (
    BranchSummaryDto,
    TenantSummaryDto,
    UserProfileDto,
)
from src.domain.error import EntityNotFoundError
from src.domain.ports.tenant_repository import ITenantRepository
from src.domain.ports.user_repository import IUserRepository
from src.domain.ports.user_tenant_repository import IUserTenantRepository


class GetUserProfileUseCase:
    """Caso de uso de consulta de perfil de utilizador (CQRS Query)."""
    def __init__(
        self,
        user_repo: IUserRepository,
        tenant_repo: ITenantRepository,
        user_tenant_repo: IUserTenantRepository,
    ):
        self.user_repo = user_repo
        self.tenant_repo = tenant_repo
        self.user_tenant_repo = user_tenant_repo

    async def execute(self, user_id: uuid.UUID) -> UserProfileDto:
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise EntityNotFoundError("Utilizador", str(user_id))

        memberships = await self.user_tenant_repo.find_user_memberships(user.id)
        tenants_summary: List[TenantSummaryDto] = []

        for m in memberships:
            if not m.is_active:
                continue
            tenant = await self.tenant_repo.find_by_id(m.tenant_id)
            if not tenant:
                continue

            branch_dto = None
            if m.default_branch_id:
                branch = await self.tenant_repo.find_branch_by_id(m.default_branch_id, tenant.id)
                if branch:
                    branch_dto = BranchSummaryDto(id=branch.id, code=branch.code, name=branch.name, city=branch.city)

            roles = await self.user_tenant_repo.get_user_roles_in_tenant(user.id, tenant.id)
            permissions = await self.user_tenant_repo.get_roles_permissions(roles)

            branches = await self.tenant_repo.find_branches(tenant.id)
            branch_dtos = [
                BranchSummaryDto(id=b.id, code=b.code, name=b.name, city=b.city) for b in branches
            ]

            tenants_summary.append(
                TenantSummaryDto(
                    id=tenant.id,
                    slug=tenant.slug,
                    company_name=tenant.company_name,
                    nif=tenant.nif,
                    roles=roles,
                    permissions=permissions,
                    default_branch=branch_dto,
                    branches=branch_dtos,
                )
            )

        return UserProfileDto(
            id=user.id,
            email=user.email.value,
            full_name=user.full_name,
            is_active=user.is_active,
            is_superadmin=user.is_superadmin,
            phone_number=user.phone_number,
            tenants=tenants_summary,
        )
