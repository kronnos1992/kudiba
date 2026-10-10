import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class Branch:
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    name: str
    is_active: bool = True
    city: Optional[str] = None
    address_detail: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
