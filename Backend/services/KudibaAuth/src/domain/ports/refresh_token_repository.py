import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
from src.domain.entities.refresh_token import RefreshToken


class IRefreshTokenRepository(ABC):
    @abstractmethod
    async def find_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        pass

    @abstractmethod
    async def save(self, token: RefreshToken) -> None:
        pass

    @abstractmethod
    async def revoke_family(self, family_id: uuid.UUID) -> None:
        """Revoga atomicamente todos os tokens da mesma família (defesa contra roubo)."""
        pass

    @abstractmethod
    async def revoke_token(self, token_hash: str) -> None:
        pass

    @abstractmethod
    async def revoke_user_tenant_tokens(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> int:
        """Revoga todos os refresh tokens activos de um utilizador num tenant (ex.: mudança de papéis)."""
        pass

    @abstractmethod
    async def replace_active_token(
        self,
        token_hash: str,
        replacement: RefreshToken,
        now: datetime,
    ) -> bool:
        """Consome um token activo e guarda o sucessor na mesma transacção."""
        pass
