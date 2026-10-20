import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, List, Optional, Sequence

from src.domain.entities import Client, License, TenantRecord


class IClientRepository(ABC):
    @abstractmethod
    async def find_by_id(self, client_id: uuid.UUID) -> Optional[Client]:
        pass

    @abstractmethod
    async def find_by_nif(self, nif: str) -> Optional[Client]:
        pass

    @abstractmethod
    async def list_all(self, search: Optional[str] = None) -> List[Client]:
        pass

    @abstractmethod
    async def save(self, client: Client) -> None:
        pass

    @abstractmethod
    async def update(self, client: Client) -> None:
        pass


class ILicenseRepository(ABC):
    @abstractmethod
    async def find_by_id(self, license_id: uuid.UUID) -> Optional[License]:
        pass

    @abstractmethod
    async def find_current_for_client(self, client_id: uuid.UUID) -> Optional[License]:
        pass

    @abstractmethod
    async def find_current_map(self, client_ids: Sequence[uuid.UUID]) -> Dict[uuid.UUID, License]:
        pass

    @abstractmethod
    async def list_for_client(self, client_id: uuid.UUID) -> List[License]:
        pass

    @abstractmethod
    async def save(self, license: License) -> None:
        pass

    @abstractmethod
    async def update(self, license: License) -> None:
        pass


class ITenantProvisioner(ABC):
    @abstractmethod
    async def slug_exists(self, slug: str) -> bool:
        pass

    @abstractmethod
    async def nif_exists(self, nif: str) -> bool:
        pass

    @abstractmethod
    async def email_exists(self, email: str) -> bool:
        pass

    @abstractmethod
    async def provision_client_tenant(
        self,
        *,
        tenant_id: uuid.UUID,
        slug: str,
        company_name: str,
        nif: str,
        license_valid_until: datetime,
        modules: List[str],
        admin_email: Optional[str] = None,
        admin_full_name: Optional[str] = None,
        admin_password_hash: Optional[str] = None,
    ) -> uuid.UUID:
        pass

    @abstractmethod
    async def update_license_mirror(
        self,
        tenant_id: uuid.UUID,
        *,
        license_valid_until: Optional[datetime] = None,
        modules: Optional[List[str]] = None,
        status: Optional[str] = None,
    ) -> None:
        pass

    @abstractmethod
    async def delete_tenant(self, tenant_id: uuid.UUID) -> None:
        pass

    @abstractmethod
    async def is_platform_admin(self, user_id: uuid.UUID) -> bool:
        pass


class ITenantReader(ABC):
    @abstractmethod
    async def list_tenants(self) -> List[TenantRecord]:
        pass
