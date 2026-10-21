import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class BranchSummaryDto:
    id: uuid.UUID
    code: str
    name: str
    city: Optional[str] = None
    address_detail: Optional[str] = None


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
    subscribed_modules: List[str] = field(default_factory=list)
    license_valid_until: Optional[datetime] = None
    trade_name: Optional[str] = None
    address_detail: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "AO"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_data_url: Optional[str] = None
    commercial_registry: Optional[str] = None
    share_capital: Optional[str] = None
    currency: str = "AOA"
    tax_regime_code: str = "REGIME_GERAL"
    tax_office_code: Optional[str] = None
    agt_cert_number: Optional[str] = None
    default_withholding_rate: float = 6.50
    invoice_footer_notes: Optional[str] = None
    bank_accounts: List[Dict[str, Any]] = field(default_factory=list)
    onboarding_completed: bool = False


@dataclass(frozen=True)
class TenantSettingsDto:
    id: uuid.UUID
    slug: str
    company_name: str
    trade_name: Optional[str]
    nif: str
    address_detail: Optional[str]
    city: Optional[str]
    province: Optional[str]
    postal_code: Optional[str]
    country: str
    phone: Optional[str]
    email: Optional[str]
    website: Optional[str]
    logo_data_url: Optional[str]
    commercial_registry: Optional[str]
    share_capital: Optional[str]
    currency: str
    tax_regime_code: str
    tax_office_code: Optional[str]
    agt_cert_number: Optional[str]
    default_withholding_rate: float
    invoice_footer_notes: Optional[str]
    bank_accounts: List[Dict[str, Any]]
    onboarding_completed: bool
    status: str
    subscribed_modules: List[str] = field(default_factory=list)
    license_valid_until: Optional[datetime] = None


@dataclass(frozen=True)
class UpdateTenantSettingsCommand:
    tenant_id: uuid.UUID
    actor_user_id: uuid.UUID
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
    nif: Optional[str] = None
    address_detail: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_data_url: Optional[str] = None
    commercial_registry: Optional[str] = None
    share_capital: Optional[str] = None
    currency: Optional[str] = None
    tax_regime_code: Optional[str] = None
    tax_office_code: Optional[str] = None
    agt_cert_number: Optional[str] = None
    default_withholding_rate: Optional[float] = None
    invoice_footer_notes: Optional[str] = None
    bank_accounts: Optional[List[Dict[str, Any]]] = None
    onboarding_completed: Optional[bool] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass(frozen=True)
class CreateBranchCommand:
    tenant_id: uuid.UUID
    actor_user_id: uuid.UUID
    code: str
    name: str
    city: Optional[str] = None
    address_detail: Optional[str] = None


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
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass(frozen=True)
class UpdateUserRolesCommand:
    tenant_id: uuid.UUID
    target_user_id: uuid.UUID
    roles: List[str]
    actor_user_id: Optional[uuid.UUID] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass(frozen=True)
class UpdateMemberStatusCommand:
    tenant_id: uuid.UUID
    target_user_id: uuid.UUID
    status: str
    actor_user_id: uuid.UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass(frozen=True)
class RemoveMemberCommand:
    tenant_id: uuid.UUID
    target_user_id: uuid.UUID
    actor_user_id: uuid.UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


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


@dataclass(frozen=True)
class RoleDto:
    id: str
    name: str
    description: Optional[str]
    is_system: bool
    permissions: List[str] = field(default_factory=list)
    users_count: int = 0
    is_editable: bool = True
    has_override: bool = False
    can_reset_override: bool = False


@dataclass(frozen=True)
class PermissionDto:
    id: str
    module: str
    name: str
    description: Optional[str] = None


@dataclass(frozen=True)
class CreateRoleCommand:
    tenant_id: uuid.UUID
    role_id: str
    name: str
    description: Optional[str] = None
    permissions: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class UpdateRoleCommand:
    tenant_id: uuid.UUID
    role_id: str
    name: str
    description: Optional[str] = None


@dataclass(frozen=True)
class UpdateRolePermissionsCommand:
    tenant_id: uuid.UUID
    role_id: str
    permissions: List[str] = field(default_factory=list)
    actor_roles: List[str] = field(default_factory=list)

