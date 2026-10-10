from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Permission:
    id: str  # ex: 'invoices:issue'
    module: str  # ex: 'fiscal'
    name: str
    description: Optional[str] = None


@dataclass
class Role:
    id: str  # ex: 'ADMIN'
    name: str
    description: Optional[str] = None
    permissions: List[Permission] = field(default_factory=list)
    is_system: bool = True
