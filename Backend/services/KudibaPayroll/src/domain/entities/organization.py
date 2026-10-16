from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class Department:
    id: UUID
    tenant_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(cls, tenant_id: UUID, code: str, name: str, description: Optional[str] = None) -> "Department":
        return cls(id=uuid4(), tenant_id=tenant_id, code=code, name=name, description=description)


@dataclass
class JobPosition:
    id: UUID
    tenant_id: UUID
    code: str
    title: str
    department_id: Optional[UUID] = None
    base_salary_min: Decimal = Decimal("0.00")
    base_salary_max: Decimal = Decimal("0.00")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        code: str,
        title: str,
        department_id: Optional[UUID] = None,
        base_salary_min: Decimal = Decimal("0.00"),
        base_salary_max: Decimal = Decimal("0.00"),
    ) -> "JobPosition":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            code=code,
            title=title,
            department_id=department_id,
            base_salary_min=base_salary_min,
            base_salary_max=base_salary_max,
        )
