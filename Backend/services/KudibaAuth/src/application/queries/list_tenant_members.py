import uuid
from typing import List
from src.application.dto import TenantMemberDto
from src.domain.ports.user_tenant_repository import IUserTenantRepository


class ListTenantMembersUseCase:
    """Caso de uso de listagem de membros de uma organização (CQRS Query)."""
    def __init__(self, user_tenant_repo: IUserTenantRepository):
        self.user_tenant_repo = user_tenant_repo

    async def execute(self, tenant_id: uuid.UUID) -> List[TenantMemberDto]:
        members_data = await self.user_tenant_repo.find_tenant_members(tenant_id)
        results: List[TenantMemberDto] = []

        for membership, email, full_name in members_data:
            roles = await self.user_tenant_repo.get_user_roles_in_tenant(membership.user_id, tenant_id)
            results.append(
                TenantMemberDto(
                    user_id=membership.user_id,
                    email=email,
                    full_name=full_name,
                    roles=roles,
                    status=membership.status,
                    default_branch_id=membership.default_branch_id,
                )
            )

        return results
