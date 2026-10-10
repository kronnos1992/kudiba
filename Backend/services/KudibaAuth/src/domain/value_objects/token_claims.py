from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class KudibaClaims:
    """Claims canónicos do JWT validados pelo API Gateway perimétrico em Rust."""
    sub: str
    tenant_id: str
    roles: List[str]
    permissions: List[str]
    exp: int
    iat: int
    jti: str
    tenant_slug: Optional[str] = None
    branch_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "sub": self.sub,
            "tenant_id": self.tenant_id,
            "tenant_slug": self.tenant_slug,
            "branch_id": self.branch_id,
            "roles": [r.upper() for r in self.roles],
            "permissions": self.permissions,
            "exp": self.exp,
            "iat": self.iat,
            "jti": self.jti,
        }
