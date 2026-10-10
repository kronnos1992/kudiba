import uuid
from abc import ABC, abstractmethod
from typing import Optional


class IAuditRepository(ABC):
    @abstractmethod
    async def record_event(
        self,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        tenant_id: Optional[uuid.UUID] = None,
        email_attempted: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        pass
