import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class Tenant:
    id: uuid.UUID
    slug: str
    company_name: str
    nif: str
    status: str = "ACTIVE"
    address_detail: Optional[str] = None
    city: Optional[str] = None
    country: str = "AO"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_active(self) -> bool:
        return self.status.upper() == "ACTIVE"
