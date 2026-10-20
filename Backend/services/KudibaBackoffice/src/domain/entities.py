import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import List, Optional


@dataclass
class Client:
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_name: str
    nif: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class License:
    id: uuid.UUID
    client_id: uuid.UUID
    license_key: str
    plan: str
    seats: int
    modules: List[str]
    valid_from: date
    valid_until: date
    status: str = "ACTIVE"
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_expired(self, today: Optional[date] = None) -> bool:
        return self.valid_until < (today or date.today())

    def derived_status(self, today: Optional[date] = None) -> str:
        today = today or date.today()
        if self.status == "SUSPENDED":
            return "SUSPENDED"
        if self.valid_until < today:
            return "EXPIRED"
        return "ACTIVE"


@dataclass
class TenantRecord:
    id: uuid.UUID
    slug: str
    company_name: str
    nif: str
    status: str
    email: Optional[str] = None
    phone: Optional[str] = None
    license_valid_until: Optional[datetime] = None
    subscribed_modules: Optional[List[str]] = None
    created_at: Optional[datetime] = None
