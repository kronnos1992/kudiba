import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class RefreshToken:
    id: uuid.UUID
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    token_hash: str
    family_id: uuid.UUID
    expires_at: datetime
    is_revoked: bool = False
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_expired(self, now: Optional[datetime] = None) -> bool:
        current_time = now or datetime.now(timezone.utc)
        return self.expires_at < current_time

    def revoke(self):
        self.is_revoked = True
