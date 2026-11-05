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

    @abstractmethod
    async def list_events(
        self,
        tenant_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        pass

    @abstractmethod
    async def count_events(self, tenant_id: uuid.UUID) -> int:
        pass

    @abstractmethod
    async def record_system_event(
        self,
        tenant_id: uuid.UUID,
        module: str,
        action: str,
        entity_type: str,
        entity_id: str,
        document_reference: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        actor_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        pass

    @abstractmethod
    async def list_system_events(
        self,
        tenant_id: uuid.UUID,
        module: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        pass

    @abstractmethod
    async def count_system_events(
        self,
        tenant_id: uuid.UUID,
        module: Optional[str] = None,
        action: Optional[str] = None,
    ) -> int:
        pass
