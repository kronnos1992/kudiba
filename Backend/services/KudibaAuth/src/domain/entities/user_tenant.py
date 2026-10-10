import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class UserTenant:
    id: uuid.UUID
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    status: str = "ACTIVE"
    default_branch_id: Optional[uuid.UUID] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_active(self) -> bool:
        return self.status.upper() == "ACTIVE"
