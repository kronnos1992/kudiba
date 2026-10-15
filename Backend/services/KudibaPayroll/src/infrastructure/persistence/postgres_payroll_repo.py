from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip, PayslipLine
from src.domain.ports.payroll_repository import PayrollRepository
from src.domain.value_objects.enums import PeriodStatus, PayslipStatus, PayslipLineType
from src.infrastructure.persistence.models import (
    PayrollPeriodModel,
    PayslipModel,
    PayslipLineModel,
)


class PostgresPayrollRepository(PayrollRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    @staticmethod
    def _to_period_entity(model: PayrollPeriodModel) -> PayrollPeriod:
        return PayrollPeriod(
            id=model.id,
            tenant_id=model.tenant_id,
            title=model.title,
            year=model.year,
            month=model.month,
            start_date=model.start_date,
            end_date=model.end_date,
            status=PeriodStatus(model.status),
            total_gross=model.total_gross,
            total_net=model.total_net,
            total_irt=model.total_irt,
            total_inss_employee=model.total_inss_employee,
            total_inss_employer=model.total_inss_employer,
            closed_at=model.closed_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_payslip_entity(model: PayslipModel) -> Payslip:
        lines = [
            PayslipLine(
                id=line.id,
                tenant_id=line.tenant_id,
                payslip_id=line.payslip_id,
                line_type=PayslipLineType(line.line_type),
                code=line.code,
                description=line.description,
                reference_value=line.reference_value,
                quantity=line.quantity,
                rate=line.rate,
                amount=line.amount,
                created_at=line.created_at,
            )
            for line in model.lines
        ]

        return Payslip(
            id=model.id,
            tenant_id=model.tenant_id,
            period_id=model.period_id,
            employee_id=model.employee_id,
            contract_id=model.contract_id,
            days_worked=model.days_worked,
            base_salary=model.base_salary,
            total_gross=model.total_gross,
            total_allowances=model.total_allowances,
            total_overtime=model.total_overtime,
            base_inss=model.base_inss,
            inss_employee=model.inss_employee,
            inss_employer=model.inss_employer,
            materia_coletavel_irt=model.materia_coletavel_irt,
            irt=model.irt,
            total_deductions=model.total_deductions,
            net_salary=model.net_salary,
            status=PayslipStatus(model.status),
            lines=lines,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_period_by_id(self, tenant_id: UUID, period_id: UUID) -> Optional[PayrollPeriod]:
        async with self.session_factory() as session:
            stmt = select(PayrollPeriodModel).where(
                PayrollPeriodModel.tenant_id == tenant_id,
                PayrollPeriodModel.id == period_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_period_entity(model) if model else None

    async def get_period_by_year_month(self, tenant_id: UUID, year: int, month: int) -> Optional[PayrollPeriod]:
        async with self.session_factory() as session:
            stmt = select(PayrollPeriodModel).where(
                PayrollPeriodModel.tenant_id == tenant_id,
                PayrollPeriodModel.year == year,
                PayrollPeriodModel.month == month,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_period_entity(model) if model else None

    async def list_periods(self, tenant_id: UUID) -> List[PayrollPeriod]:
        async with self.session_factory() as session:
            stmt = (
                select(PayrollPeriodModel)
                .where(PayrollPeriodModel.tenant_id == tenant_id)
                .order_by(PayrollPeriodModel.year.desc(), PayrollPeriodModel.month.desc())
            )
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._to_period_entity(m) for m in models]

    async def save_period(self, period: PayrollPeriod) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(PayrollPeriodModel).where(
                    PayrollPeriodModel.tenant_id == period.tenant_id,
                    PayrollPeriodModel.id == period.id,
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()

                if model:
                    model.title = period.title
                    model.status = period.status.value
                    model.total_gross = period.total_gross
                    model.total_net = period.total_net
                    model.total_irt = period.total_irt
                    model.total_inss_employee = period.total_inss_employee
                    model.total_inss_employer = period.total_inss_employer
                    model.closed_at = period.closed_at
                else:
                    new_model = PayrollPeriodModel(
                        id=period.id,
                        tenant_id=period.tenant_id,
                        title=period.title,
                        year=period.year,
                        month=period.month,
                        start_date=period.start_date,
                        end_date=period.end_date,
                        status=period.status.value,
                        total_gross=period.total_gross,
                        total_net=period.total_net,
                        total_irt=period.total_irt,
                        total_inss_employee=period.total_inss_employee,
                        total_inss_employer=period.total_inss_employer,
                        closed_at=period.closed_at,
                    )
                    session.add(new_model)

    async def save_payslips(self, period_id: UUID, payslips: List[Payslip]) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                for payslip in payslips:
                    stmt = select(PayslipModel).where(
                        PayslipModel.tenant_id == payslip.tenant_id,
                        PayslipModel.id == payslip.id,
                    )
                    res = await session.execute(stmt)
                    model = res.scalar_one_or_none()

                    if model:
                        model.days_worked = payslip.days_worked
                        model.base_salary = payslip.base_salary
                        model.total_gross = payslip.total_gross
                        model.total_allowances = payslip.total_allowances
                        model.total_overtime = payslip.total_overtime
                        model.base_inss = payslip.base_inss
                        model.inss_employee = payslip.inss_employee
                        model.inss_employer = payslip.inss_employer
                        model.materia_coletavel_irt = payslip.materia_coletavel_irt
                        model.irt = payslip.irt
                        model.total_deductions = payslip.total_deductions
                        model.net_salary = payslip.net_salary
                        model.status = payslip.status.value
                    else:
                        new_model = PayslipModel(
                            id=payslip.id,
                            tenant_id=payslip.tenant_id,
                            period_id=payslip.period_id,
                            employee_id=payslip.employee_id,
                            contract_id=payslip.contract_id,
                            days_worked=payslip.days_worked,
                            base_salary=payslip.base_salary,
                            total_gross=payslip.total_gross,
                            total_allowances=payslip.total_allowances,
                            total_overtime=payslip.total_overtime,
                            base_inss=payslip.base_inss,
                            inss_employee=payslip.inss_employee,
                            inss_employer=payslip.inss_employer,
                            materia_coletavel_irt=payslip.materia_coletavel_irt,
                            irt=payslip.irt,
                            total_deductions=payslip.total_deductions,
                            net_salary=payslip.net_salary,
                            status=payslip.status.value,
                        )
                        session.add(new_model)

                        for line in payslip.lines:
                            line_model = PayslipLineModel(
                                id=line.id,
                                tenant_id=line.tenant_id,
                                payslip_id=line.payslip_id,
                                line_type=line.line_type.value,
                                code=line.code,
                                description=line.description,
                                reference_value=line.reference_value,
                                quantity=line.quantity,
                                rate=line.rate,
                                amount=line.amount,
                            )
                            session.add(line_model)

    async def list_payslips_by_period(self, tenant_id: UUID, period_id: UUID) -> List[Payslip]:
        async with self.session_factory() as session:
            stmt = (
                select(PayslipModel)
                .where(
                    PayslipModel.tenant_id == tenant_id,
                    PayslipModel.period_id == period_id,
                )
            )
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._to_payslip_entity(m) for m in models]

    async def get_payslip_by_id(self, tenant_id: UUID, payslip_id: UUID) -> Optional[Payslip]:
        async with self.session_factory() as session:
            stmt = select(PayslipModel).where(
                PayslipModel.tenant_id == tenant_id,
                PayslipModel.id == payslip_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_payslip_entity(model) if model else None
