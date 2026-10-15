from dataclasses import dataclass
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.config import Settings
from src.application.commands import (
    RegisterEmployeeUseCase,
    TerminateEmployeeUseCase,
    CreateContractUseCase,
    AddSalaryComponentUseCase,
    OpenPayrollPeriodUseCase,
    CalculatePayrollPeriodUseCase,
    ClosePayrollPeriodUseCase,
)
from src.application.queries import (
    GetEmployeeUseCase,
    ListEmployeesUseCase,
    GetPayrollPeriodUseCase,
    ListPayrollPeriodsUseCase,
    ListPayslipsUseCase,
    GetPayslipUseCase,
    ExportPs2UseCase,
)
from src.infrastructure.persistence import (
    PostgresEmployeeRepository,
    PostgresContractRepository,
    PostgresPayrollRepository,
)
from src.infrastructure.events.rabbitmq_publisher import RabbitMqEventPublisher


@dataclass
class AppState:
    config: Settings
    publisher: RabbitMqEventPublisher

    # Casos de Uso (Commands)
    register_employee: RegisterEmployeeUseCase
    terminate_employee: TerminateEmployeeUseCase
    create_contract: CreateContractUseCase
    add_salary_component: AddSalaryComponentUseCase
    open_payroll_period: OpenPayrollPeriodUseCase
    calculate_payroll_period: CalculatePayrollPeriodUseCase
    close_payroll_period: ClosePayrollPeriodUseCase

    # Casos de Uso (Queries)
    get_employee: GetEmployeeUseCase
    list_employees: ListEmployeesUseCase
    get_payroll_period: GetPayrollPeriodUseCase
    list_payroll_periods: ListPayrollPeriodsUseCase
    list_payslips: ListPayslipsUseCase
    get_payslip: GetPayslipUseCase
    export_ps2: ExportPs2UseCase


def create_app_state(
    config: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    publisher: Optional[RabbitMqEventPublisher] = None,
) -> AppState:
    employee_repo = PostgresEmployeeRepository(session_factory)
    contract_repo = PostgresContractRepository(session_factory)
    payroll_repo = PostgresPayrollRepository(session_factory)
    pub = publisher or RabbitMqEventPublisher(config.rabbitmq_url)

    register_employee = RegisterEmployeeUseCase(employee_repo)
    terminate_employee = TerminateEmployeeUseCase(employee_repo)
    create_contract = CreateContractUseCase(contract_repo, employee_repo)
    add_salary_component = AddSalaryComponentUseCase(contract_repo)
    open_payroll_period = OpenPayrollPeriodUseCase(payroll_repo)
    calculate_payroll_period = CalculatePayrollPeriodUseCase(payroll_repo, contract_repo, employee_repo)
    close_payroll_period = ClosePayrollPeriodUseCase(payroll_repo, pub)

    get_employee = GetEmployeeUseCase(employee_repo)
    list_employees = ListEmployeesUseCase(employee_repo)
    get_payroll_period = GetPayrollPeriodUseCase(payroll_repo)
    list_payroll_periods = ListPayrollPeriodsUseCase(payroll_repo)
    list_payslips = ListPayslipsUseCase(payroll_repo)
    get_payslip = GetPayslipUseCase(payroll_repo)
    export_ps2 = ExportPs2UseCase(payroll_repo, employee_repo)

    return AppState(
        config=config,
        publisher=pub,
        register_employee=register_employee,
        terminate_employee=terminate_employee,
        create_contract=create_contract,
        add_salary_component=add_salary_component,
        open_payroll_period=open_payroll_period,
        calculate_payroll_period=calculate_payroll_period,
        close_payroll_period=close_payroll_period,
        get_employee=get_employee,
        list_employees=list_employees,
        get_payroll_period=get_payroll_period,
        list_payroll_periods=list_payroll_periods,
        list_payslips=list_payslips,
        get_payslip=get_payslip,
        export_ps2=export_ps2,
    )
