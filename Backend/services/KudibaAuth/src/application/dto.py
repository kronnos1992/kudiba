import uuid
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class BranchSummaryDto:
    id: uuid.UUID
    code: str
    name: str
    city: Optional[str] = None


@dataclass(frozen=True)
class TenantSummaryDto:
    id: uuid.UUID
    slug: str
    company_name: str
    nif: str
    roles: List[str]
    permissions: List[str]
    default_branch: Optional[BranchSummaryDto] = None
    branches: List[BranchSummaryDto] = field(default_factory=list)


@dataclass(frozen=True)
class UserSummaryDto:
    id: uuid.UUID
    email: str
    full_name: str
    is_superadmin: bool


@dataclass(frozen=True)
class AuthenticationResult:
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: UserSummaryDto
    active_tenant: TenantSummaryDto


@dataclass(frozen=True)
class AuthenticateUserCommand:
    email: str
    password: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    target_tenant_id: Optional[uuid.UUID] = None


@dataclass(frozen=True)
class RotateRefreshTokenCommand:
    refresh_token: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass(frozen=True)
class LogoutUserCommand:
    user_id: Optional[uuid.UUID] = None
    refresh_token: Optional[str] = None
    access_token_jti: Optional[str] = None
    access_token_exp: Optional[int] = None
    ip_address: Optional[str] = None


@dataclass(frozen=True)
class SwitchTenantCommand:
    user_id: uuid.UUID
    target_tenant_id: uuid.UUID
    target_branch_id: Optional[uuid.UUID] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass(frozen=True)
class InviteUserCommand:
    target_tenant_id: uuid.UUID
    email: str
    full_name: str
    roles: List[str]
    branch_id: Optional[uuid.UUID] = None
    password: Optional[str] = None
    actor_user_id: Optional[uuid.UUID] = None


@dataclass(frozen=True)
class UpdateUserRolesCommand:
    tenant_id: uuid.UUID
    target_user_id: uuid.UUID
    roles: List[str]
    actor_user_id: Optional[uuid.UUID] = None


@dataclass(frozen=True)
class TenantMemberDto:
    user_id: uuid.UUID
    email: str
    full_name: str
    roles: List[str]
    status: str
    default_branch_id: Optional[uuid.UUID] = None


@dataclass(frozen=True)
class UserProfileDto:
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_superadmin: bool
    phone_number: Optional[str] = None
    tenants: List[TenantSummaryDto] = field(default_factory=list)
