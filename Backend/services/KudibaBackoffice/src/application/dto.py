import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional


@dataclass(frozen=True)
class LicenseDto:
    id: uuid.UUID
    license_key: str
    plan: str
    seats: int
    modules: List[str]
    valid_from: date
    valid_until: date
    status: str
    expired: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass(frozen=True)
class ClientDto:
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_name: str
    nif: str
    contact_name: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    notes: Optional[str]
    license_status: str
    license: Optional[LicenseDto]
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class ClientDetailDto(ClientDto):
    license_history: List[LicenseDto] = field(default_factory=list)


@dataclass(frozen=True)
class CreateClientCommand:
    company_name: str
    nif: str
    modules: List[str]
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    plan: str = "STANDARD"
    seats: int = 5
    admin_email: Optional[str] = None
    admin_full_name: Optional[str] = None
    admin_password: Optional[str] = None


@dataclass(frozen=True)
class UpdateClientCommand:
    client_id: uuid.UUID
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


@dataclass(frozen=True)
class RenewLicenseCommand:
    client_id: uuid.UUID
    modules: Optional[List[str]] = None
    plan: Optional[str] = None
    seats: Optional[int] = None
    notes: Optional[str] = None


@dataclass(frozen=True)
class SetLicenseStatusCommand:
    client_id: uuid.UUID
    action: str


@dataclass(frozen=True)
class PlatformClientStats:
    total: int
    active: int
    expired: int
    suspended: int
    none: int


@dataclass(frozen=True)
class PlatformLicenseStats:
    total: int
    active: int
    expiring_soon: int
    expired: int
    suspended: int


@dataclass(frozen=True)
class PlatformModuleAdoption:
    key: str
    name: str
    client_count: int


@dataclass(frozen=True)
class PlatformSummaryDto:
    generated_at: datetime
    clients: PlatformClientStats
    licenses: PlatformLicenseStats
    active_seats: int
    modules: List[PlatformModuleAdoption]


@dataclass(frozen=True)
class CommercialMonthBucket:
    month: str
    count: int


@dataclass(frozen=True)
class PlatformCommercialSummaryDto:
    generated_at: datetime
    total_clients: int
    new_this_month: int
    new_last_month: int
    growth_rate: Optional[float]
    new_last_12m: int
    monthly: List[CommercialMonthBucket]
