from dataclasses import dataclass
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.config import Settings
from src.application.commands import (
    RegisterEmployeeUseCase,
    TerminateEmployeeUseCase,
    UpdateEmployeeUseCase,
    CreateContractUseCase,
    AddSalaryComponentUseCase,
    CreateDepartmentUseCase,
    CreateJobPositionUseCase,
    RequestVacationUseCase,
    DecideVacationUseCase,
    RecordAbsenceUseCase,
    RecordAttendanceUseCase,
    MarkPayslipPaidUseCase,
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
    ListContractsUseCase,
    GetContractUseCase,
    GetPeriodSummaryUseCase,
    GetVacationBalanceUseCase,
    ListDepartmentsUseCase,
    ListJobPositionsUseCase,
    ListVacationsUseCase,
    ListAbsencesUseCase,
    ListAttendanceUseCase,
    GeneratePayslipPdfUseCase,
    ExportPs2UseCase,
)
from src.application.events import AttendanceEventHandler
from src.infrastructure.persistence import (
    PostgresEmployeeRepository,
    PostgresContractRepository,
    PostgresPayrollRepository,
    PostgresOrganizationRepository,
    PostgresHrRepository,
)
from src.infrastructure.events.rabbitmq_publisher import RabbitMqEventPublisher
from src.infrastructure.events.rabbitmq_consumer import RabbitMqEventConsumer
from src.infrastructure.events.outbox_worker import PayrollOutboxWorker


@dataclass
class AppState:
    config: Settings
    publisher: RabbitMqEventPublisher
    attendance_consumer: Optional[RabbitMqEventConsumer]
    outbox_worker: PayrollOutboxWorker


    register_employee: RegisterEmployeeUseCase
    terminate_employee: TerminateEmployeeUseCase
    update_employee: UpdateEmployeeUseCase
    create_contract: CreateContractUseCase
    add_salary_component: AddSalaryComponentUseCase
    create_department: CreateDepartmentUseCase
    create_job_position: CreateJobPositionUseCase
    request_vacation: RequestVacationUseCase
    decide_vacation: DecideVacationUseCase
    record_absence: RecordAbsenceUseCase
    record_attendance: RecordAttendanceUseCase
    mark_payslip_paid: MarkPayslipPaidUseCase
    open_payroll_period: OpenPayrollPeriodUseCase
    calculate_payroll_period: CalculatePayrollPeriodUseCase
    close_payroll_period: ClosePayrollPeriodUseCase

    get_employee: GetEmployeeUseCase
    list_employees: ListEmployeesUseCase
    get_payroll_period: GetPayrollPeriodUseCase
    list_payroll_periods: ListPayrollPeriodsUseCase
    list_payslips: ListPayslipsUseCase
    get_payslip: GetPayslipUseCase
    list_contracts: ListContractsUseCase
    get_contract: GetContractUseCase
    get_period_summary: GetPeriodSummaryUseCase
    get_vacation_balance: GetVacationBalanceUseCase
    list_departments: ListDepartmentsUseCase
    list_job_positions: ListJobPositionsUseCase
    list_vacations: ListVacationsUseCase
    list_absences: ListAbsencesUseCase
    list_attendance: ListAttendanceUseCase
    generate_payslip_pdf: GeneratePayslipPdfUseCase
    export_ps2: ExportPs2UseCase


def create_app_state(
    config: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    publisher: Optional[RabbitMqEventPublisher] = None,
) -> AppState:
    employee_repo = PostgresEmployeeRepository(session_factory)
    contract_repo = PostgresContractRepository(session_factory)
    payroll_repo = PostgresPayrollRepository(session_factory)
    org_repo = PostgresOrganizationRepository(session_factory)
    hr_repo = PostgresHrRepository(session_factory)
    pub = publisher or RabbitMqEventPublisher(config.rabbitmq_url)

    register_employee = RegisterEmployeeUseCase(employee_repo)
    terminate_employee = TerminateEmployeeUseCase(employee_repo)
    update_employee = UpdateEmployeeUseCase(employee_repo)
    create_contract = CreateContractUseCase(contract_repo, employee_repo)
    add_salary_component = AddSalaryComponentUseCase(contract_repo)
    create_department = CreateDepartmentUseCase(org_repo)
    create_job_position = CreateJobPositionUseCase(org_repo)
    request_vacation = RequestVacationUseCase(hr_repo, employee_repo)
    decide_vacation = DecideVacationUseCase(hr_repo)
    record_absence = RecordAbsenceUseCase(hr_repo, employee_repo)
    record_attendance = RecordAttendanceUseCase(hr_repo, employee_repo)
    mark_payslip_paid = MarkPayslipPaidUseCase(payroll_repo)
    open_payroll_period = OpenPayrollPeriodUseCase(payroll_repo)
    calculate_payroll_period = CalculatePayrollPeriodUseCase(
        payroll_repo, contract_repo, employee_repo, hr_repo
    )
    close_payroll_period = ClosePayrollPeriodUseCase(payroll_repo, pub)

    get_employee = GetEmployeeUseCase(employee_repo)
    list_employees = ListEmployeesUseCase(employee_repo)
    get_payroll_period = GetPayrollPeriodUseCase(payroll_repo)
    list_payroll_periods = ListPayrollPeriodsUseCase(payroll_repo)
    list_payslips = ListPayslipsUseCase(payroll_repo)
    get_payslip = GetPayslipUseCase(payroll_repo)
    list_contracts = ListContractsUseCase(contract_repo)
    get_contract = GetContractUseCase(contract_repo)
    get_period_summary = GetPeriodSummaryUseCase(payroll_repo, employee_repo)
    get_vacation_balance = GetVacationBalanceUseCase(hr_repo, employee_repo)
    list_departments = ListDepartmentsUseCase(org_repo)
    list_job_positions = ListJobPositionsUseCase(org_repo)
    list_vacations = ListVacationsUseCase(hr_repo)
    list_absences = ListAbsencesUseCase(hr_repo)
    list_attendance = ListAttendanceUseCase(hr_repo)
    generate_payslip_pdf = GeneratePayslipPdfUseCase(payroll_repo, employee_repo)
    export_ps2 = ExportPs2UseCase(payroll_repo, employee_repo)

    attendance_handler = AttendanceEventHandler(record_attendance)
    attendance_consumer = (
        RabbitMqEventConsumer(
            rabbitmq_url=config.rabbitmq_url,
            exchange_name=config.event_exchange,
            queue_name=config.attendance_queue,
            routing_keys=["payroll.event.attendance.#"],
            handler=attendance_handler.handle,
        )
        if config.attendance_consumer_enabled
        else None
    )

    outbox_worker = PayrollOutboxWorker(
        payroll_repo=payroll_repo,
        event_publisher=pub,
        poll_interval=5.0,
    )

    return AppState(
        config=config,
        publisher=pub,
        attendance_consumer=attendance_consumer,
        outbox_worker=outbox_worker,

        register_employee=register_employee,
        terminate_employee=terminate_employee,
        update_employee=update_employee,
        create_contract=create_contract,
        add_salary_component=add_salary_component,
        create_department=create_department,
        create_job_position=create_job_position,
        request_vacation=request_vacation,
        decide_vacation=decide_vacation,
        record_absence=record_absence,
        record_attendance=record_attendance,
        mark_payslip_paid=mark_payslip_paid,
        open_payroll_period=open_payroll_period,
        calculate_payroll_period=calculate_payroll_period,
        close_payroll_period=close_payroll_period,
        get_employee=get_employee,
        list_employees=list_employees,
        get_payroll_period=get_payroll_period,
        list_payroll_periods=list_payroll_periods,
        list_payslips=list_payslips,
        get_payslip=get_payslip,
        list_contracts=list_contracts,
        get_contract=get_contract,
        get_period_summary=get_period_summary,
        get_vacation_balance=get_vacation_balance,
        list_departments=list_departments,
        list_job_positions=list_job_positions,
        list_vacations=list_vacations,
        list_absences=list_absences,
        list_attendance=list_attendance,
        generate_payslip_pdf=generate_payslip_pdf,
        export_ps2=export_ps2,
    )
