from abc import ABC, abstractmethod


class ICacheService(ABC):
    @abstractmethod
    async def blacklist_token(self, jti: str, ttl_seconds: int) -> None:
        pass

    @abstractmethod
    async def is_token_blacklisted(self, jti: str) -> bool:
        pass

    @abstractmethod
    async def revoke_sessions_before(self, user_id: str, tenant_id: str, epoch: int, ttl_seconds: int) -> None:
        """Marca todas as sessões de um utilizador/tenant emitidas antes de `epoch` como inválidas."""
        pass

    @abstractmethod
    async def get_revoked_before(self, user_id: str, tenant_id: str) -> int:
        """Devolve o instante (unix) a partir do qual os tokens foram revogados, ou 0 se não houver."""
        pass
