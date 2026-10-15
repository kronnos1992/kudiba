from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.employee import Employee
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.value_objects.enums import EmployeeStatus
from src.infrastructure.persistence.models import EmployeeModel


class PostgresEmployeeRepository(EmployeeRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    @staticmethod
    def _to_entity(model: EmployeeModel) -> Employee:
        return Employee(
            id=model.id,
            tenant_id=model.tenant_id,
            code=model.code,
            full_name=model.full_name,
            nif=model.nif,
            identity_card_number=model.identity_card_number,
            iban=model.iban,
            hire_date=model.hire_date,
            status=EmployeeStatus(model.status),
            inss_number=model.inss_number,
            birth_date=model.birth_date,
            gender=model.gender,
            marital_status=model.marital_status,
            dependents_count=model.dependents_count,
            email=model.email,
            phone=model.phone,
            bank_code=model.bank_code,
            address=model.address,
            termination_date=model.termination_date,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, tenant_id: UUID, employee_id: UUID) -> Optional[Employee]:
        async with self.session_factory() as session:
            stmt = select(EmployeeModel).where(
                EmployeeModel.tenant_id == tenant_id,
                EmployeeModel.id == employee_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_entity(model) if model else None

    async def get_by_code(self, tenant_id: UUID, code: str) -> Optional[Employee]:
        async with self.session_factory() as session:
            stmt = select(EmployeeModel).where(
                EmployeeModel.tenant_id == tenant_id,
                EmployeeModel.code == code,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_entity(model) if model else None

    async def get_by_nif(self, tenant_id: UUID, nif: str) -> Optional[Employee]:
        async with self.session_factory() as session:
            stmt = select(EmployeeModel).where(
                EmployeeModel.tenant_id == tenant_id,
                EmployeeModel.nif == nif,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_entity(model) if model else None

    async def list_active(self, tenant_id: UUID) -> List[Employee]:
        async with self.session_factory() as session:
            stmt = (
                select(EmployeeModel)
                .where(
                    EmployeeModel.tenant_id == tenant_id,
                    EmployeeModel.status == EmployeeStatus.ACTIVE.value,
                )
                .order_by(EmployeeModel.code)
            )
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._to_entity(m) for m in models]

    async def save(self, employee: Employee) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(EmployeeModel).where(
                    EmployeeModel.tenant_id == employee.tenant_id,
                    EmployeeModel.id == employee.id,
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()

                if model:
                    model.code = employee.code
                    model.full_name = employee.full_name
                    model.nif = employee.nif
                    model.identity_card_number = employee.identity_card_number
                    model.iban = employee.iban
                    model.hire_date = employee.hire_date
                    model.status = employee.status.value
                    model.inss_number = employee.inss_number
                    model.birth_date = employee.birth_date
                    model.gender = employee.gender
                    model.marital_status = employee.marital_status
                    model.dependents_count = employee.dependents_count
                    model.email = employee.email
                    model.phone = employee.phone
                    model.bank_code = employee.bank_code
                    model.address = employee.address
                    model.termination_date = employee.termination_date
                else:
                    new_model = EmployeeModel(
                        id=employee.id,
                        tenant_id=employee.tenant_id,
                        code=employee.code,
                        full_name=employee.full_name,
                        nif=employee.nif,
                        inss_number=employee.inss_number,
                        identity_card_number=employee.identity_card_number,
                        birth_date=employee.birth_date,
                        gender=employee.gender,
                        marital_status=employee.marital_status,
                        dependents_count=employee.dependents_count,
                        email=employee.email,
                        phone=employee.phone,
                        iban=employee.iban,
                        bank_code=employee.bank_code,
                        address=employee.address,
                        status=employee.status.value,
                        hire_date=employee.hire_date,
                        termination_date=employee.termination_date,
                    )
                    session.add(new_model)
