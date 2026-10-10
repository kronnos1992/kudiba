from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class ITokenService(ABC):
    @abstractmethod
    def create_access_token(
        self,
        user_id: str,
        tenant_id: str,
        roles: List[str],
        permissions: List[str],
        tenant_slug: Optional[str] = None,
        branch_id: Optional[str] = None,
        expires_minutes: Optional[int] = None,
    ) -> Tuple[str, str, int]:
        """Retorna (token_jwt, jti, exp_timestamp)."""
        pass

    @abstractmethod
    def decode_access_token(self, token: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def generate_refresh_token(self) -> Tuple[str, str]:
        """Retorna (raw_token, token_hash)."""
        pass

    @abstractmethod
    def hash_refresh_token(self, raw_token: str) -> str:
        pass
