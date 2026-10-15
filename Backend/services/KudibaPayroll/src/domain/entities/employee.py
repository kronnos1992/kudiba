from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4
from src.domain.value_objects.enums import EmployeeStatus


@dataclass
class Employee:
    id: UUID
    tenant_id: UUID
    code: str
    full_name: str
    nif: str
    identity_card_number: str
    iban: str
    hire_date: date
    status: EmployeeStatus
    inss_number: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    dependents_count: int = 0
    email: Optional[str] = None
    phone: Optional[str] = None
    bank_code: Optional[str] = None
    address: Optional[str] = None
    termination_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        code: str,
        full_name: str,
        nif: str,
        identity_card_number: str,
        iban: str,
        hire_date: date,
        inss_number: Optional[str] = None,
        birth_date: Optional[date] = None,
        gender: Optional[str] = None,
        marital_status: Optional[str] = None,
        dependents_count: int = 0,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        bank_code: Optional[str] = None,
        address: Optional[str] = None,
    ) -> "Employee":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            code=code,
            full_name=full_name,
            nif=nif,
            identity_card_number=identity_card_number,
            iban=iban,
            hire_date=hire_date,
            status=EmployeeStatus.ACTIVE,
            inss_number=inss_number,
            birth_date=birth_date,
            gender=gender,
            marital_status=marital_status,
            dependents_count=dependents_count,
            email=email,
            phone=phone,
            bank_code=bank_code,
            address=address,
            termination_date=None,
        )

    def terminate(self, termination_date: date) -> None:
        self.status = EmployeeStatus.TERMINATED
        self.termination_date = termination_date
