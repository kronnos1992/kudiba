from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.contract import Contract, SalaryComponent
from src.domain.ports.contract_repository import ContractRepository
from src.domain.value_objects.enums import ContractStatus, ContractType, ComponentType
from src.infrastructure.persistence.models import ContractModel, SalaryComponentModel


class PostgresContractRepository(ContractRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    @staticmethod
    def _to_entity(model: ContractModel) -> Contract:
        components = [
            SalaryComponent(
                id=c.id,
                tenant_id=c.tenant_id,
                contract_id=c.contract_id,
                component_type=ComponentType(c.component_type),
                name=c.name,
                amount=c.amount,
                is_taxable_irt=c.is_taxable_irt,
                is_taxable_inss=c.is_taxable_inss,
                is_active=c.is_active,
                created_at=c.created_at,
            )
            for c in model.components
        ]

        return Contract(
            id=model.id,
            tenant_id=model.tenant_id,
            employee_id=model.employee_id,
            contract_type=ContractType(model.contract_type),
            start_date=model.start_date,
            base_salary=model.base_salary,
            status=ContractStatus(model.status),
            job_position_id=model.job_position_id,
            end_date=model.end_date,
            components=components,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, tenant_id: UUID, contract_id: UUID) -> Optional[Contract]:
        async with self.session_factory() as session:
            stmt = select(ContractModel).where(
                ContractModel.tenant_id == tenant_id,
                ContractModel.id == contract_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_entity(model) if model else None

    async def get_active_by_employee(self, tenant_id: UUID, employee_id: UUID) -> Optional[Contract]:
        async with self.session_factory() as session:
            stmt = (
                select(ContractModel)
                .where(
                    ContractModel.tenant_id == tenant_id,
                    ContractModel.employee_id == employee_id,
                    ContractModel.status == ContractStatus.ACTIVE.value,
                )
                .order_by(ContractModel.start_date.desc())
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_entity(model) if model else None

    async def list_active_contracts(self, tenant_id: UUID) -> List[Contract]:
        async with self.session_factory() as session:
            stmt = (
                select(ContractModel)
                .where(
                    ContractModel.tenant_id == tenant_id,
                    ContractModel.status == ContractStatus.ACTIVE.value,
                )
                .order_by(ContractModel.start_date)
            )
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._to_entity(m) for m in models]

    async def list_contracts(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        status: Optional[ContractStatus] = None,
    ) -> List[Contract]:
        async with self.session_factory() as session:
            stmt = select(ContractModel).where(ContractModel.tenant_id == tenant_id)
            if employee_id:
                stmt = stmt.where(ContractModel.employee_id == employee_id)
            if status:
                stmt = stmt.where(ContractModel.status == status.value)
            stmt = stmt.order_by(ContractModel.start_date.desc())
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._to_entity(m) for m in models]

    async def save(self, contract: Contract) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(ContractModel).where(
                    ContractModel.tenant_id == contract.tenant_id,
                    ContractModel.id == contract.id,
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()

                if model:
                    model.contract_type = contract.contract_type.value
                    model.start_date = contract.start_date
                    model.end_date = contract.end_date
                    model.base_salary = contract.base_salary
                    model.status = contract.status.value
                    model.job_position_id = contract.job_position_id
                else:
                    new_model = ContractModel(
                        id=contract.id,
                        tenant_id=contract.tenant_id,
                        employee_id=contract.employee_id,
                        job_position_id=contract.job_position_id,
                        contract_type=contract.contract_type.value,
                        start_date=contract.start_date,
                        end_date=contract.end_date,
                        base_salary=contract.base_salary,
                        status=contract.status.value,
                    )
                    session.add(new_model)

                    for c in contract.components:
                        comp_model = SalaryComponentModel(
                            id=c.id,
                            tenant_id=c.tenant_id,
                            contract_id=contract.id,
                            component_type=c.component_type.value,
                            name=c.name,
                            amount=c.amount,
                            is_taxable_irt=c.is_taxable_irt,
                            is_taxable_inss=c.is_taxable_inss,
                            is_active=c.is_active,
                        )
                        session.add(comp_model)

    async def add_component(self, component: SalaryComponent) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                comp_model = SalaryComponentModel(
                    id=component.id,
                    tenant_id=component.tenant_id,
                    contract_id=component.contract_id,
                    component_type=component.component_type.value,
                    name=component.name,
                    amount=component.amount,
                    is_taxable_irt=component.is_taxable_irt,
                    is_taxable_inss=component.is_taxable_inss,
                    is_active=component.is_active,
                )
                session.add(comp_model)
