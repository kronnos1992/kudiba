-- =============================================================================
-- Kudiba ERP — Microsserviço de Recursos Humanos e Processamento Salarial (KudibaPayroll)
-- Schema DDL: kudiba_payroll
-- Conformidade: Lei Geral do Trabalho n.º 12/23, Código do IRT (Lei 18/14 e Lei 28/20),
-- Protecção Social Obrigatória / INSS (Decreto Presidencial n.º 227/18)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_payroll;

-- 1. TIPOS ENUMERADOS
DO $$ BEGIN
    CREATE TYPE kudiba_payroll.contract_type AS ENUM (
        'PERMANENT',
        'FIXED_TERM',
        'PROBATION',
        'PART_TIME',
        'INTERNSHIP'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_payroll.employee_status AS ENUM (
        'ACTIVE',
        'ON_LEAVE',
        'SUSPENDED',
        'TERMINATED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_payroll.contract_status AS ENUM (
        'ACTIVE',
        'SUSPENDED',
        'TERMINATED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_payroll.period_status AS ENUM (
        'DRAFT',
        'CALCULATED',
        'CLOSED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_payroll.component_type AS ENUM (
        'BASE_SALARY',
        'FOOD_ALLOWANCE',
        'TRANSPORT_ALLOWANCE',
        'HOUSING_ALLOWANCE',
        'FUNCTION_ALLOWANCE',
        'OVERTIME_50',
        'OVERTIME_75',
        'BONUS',
        'DEDUCTION_ADVANCE',
        'DEDUCTION_LOAN',
        'OTHER_EARNING',
        'OTHER_DEDUCTION'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_payroll.payslip_status AS ENUM (
        'DRAFT',
        'APPROVED',
        'PAID'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. TABELA DE DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS kudiba_payroll.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_dept_tenant_code UNIQUE (tenant_id, code)
);

-- 3. TABELA DE CARGOS / FUNÇÕES
CREATE TABLE IF NOT EXISTS kudiba_payroll.job_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    department_id UUID REFERENCES kudiba_payroll.departments(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    base_salary_min NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    base_salary_max NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_job_tenant_code UNIQUE (tenant_id, code)
);

-- 4. TABELA DE COLABORADORES
CREATE TABLE IF NOT EXISTS kudiba_payroll.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    nif VARCHAR(20) NOT NULL,
    inss_number VARCHAR(30),
    identity_card_number VARCHAR(30) NOT NULL,
    birth_date DATE,
    gender VARCHAR(10),
    marital_status VARCHAR(20),
    dependents_count INT NOT NULL DEFAULT 0,
    email VARCHAR(255),
    phone VARCHAR(50),
    iban VARCHAR(34) NOT NULL,
    bank_code VARCHAR(10),
    address TEXT,
    status kudiba_payroll.employee_status NOT NULL DEFAULT 'ACTIVE',
    hire_date DATE NOT NULL,
    termination_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_emp_tenant_nif UNIQUE (tenant_id, nif),
    CONSTRAINT uq_emp_tenant_bi UNIQUE (tenant_id, identity_card_number)
);

-- 5. TABELA DE CONTRATOS DE TRABALHO
CREATE TABLE IF NOT EXISTS kudiba_payroll.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL REFERENCES kudiba_payroll.employees(id) ON DELETE RESTRICT,
    job_position_id UUID REFERENCES kudiba_payroll.job_positions(id) ON DELETE RESTRICT,
    contract_type kudiba_payroll.contract_type NOT NULL DEFAULT 'PERMANENT',
    start_date DATE NOT NULL,
    end_date DATE,
    base_salary NUMERIC(15, 2) NOT NULL CHECK (base_salary >= 0),
    status kudiba_payroll.contract_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. COMPONENTES SALARIAIS RECORRENTES DO CONTRATO
CREATE TABLE IF NOT EXISTS kudiba_payroll.salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    contract_id UUID NOT NULL REFERENCES kudiba_payroll.contracts(id) ON DELETE CASCADE,
    component_type kudiba_payroll.component_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    is_taxable_irt BOOLEAN NOT NULL DEFAULT TRUE,
    is_taxable_inss BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. PERIODOS DE PROCESSAMENTO SALARIAL
CREATE TABLE IF NOT EXISTS kudiba_payroll.payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(150) NOT NULL,
    year INT NOT NULL CHECK (year >= 2020),
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status kudiba_payroll.period_status NOT NULL DEFAULT 'DRAFT',
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_irt NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_inss_employee NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_inss_employer NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_period_tenant_year_month UNIQUE (tenant_id, year, month)
);

-- 8. RECIBOS DE VENCIMENTO / PAYSLEIP
CREATE TABLE IF NOT EXISTS kudiba_payroll.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    period_id UUID NOT NULL REFERENCES kudiba_payroll.payroll_periods(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES kudiba_payroll.employees(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL REFERENCES kudiba_payroll.contracts(id) ON DELETE RESTRICT,
    days_worked INT NOT NULL DEFAULT 22 CHECK (days_worked >= 0 AND days_worked <= 31),
    base_salary NUMERIC(15, 2) NOT NULL,
    total_gross NUMERIC(15, 2) NOT NULL,
    total_allowances NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_overtime NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(15, 2) NOT NULL,
    inss_employee NUMERIC(15, 2) NOT NULL,
    inss_employer NUMERIC(15, 2) NOT NULL,
    materia_coletavel_irt NUMERIC(15, 2) NOT NULL,
    irt NUMERIC(15, 2) NOT NULL,
    total_deductions NUMERIC(15, 2) NOT NULL,
    net_salary NUMERIC(15, 2) NOT NULL,
    status kudiba_payroll.payslip_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payslip_period_employee UNIQUE (period_id, employee_id),
    CONSTRAINT chk_payslip_balance CHECK (net_salary = total_gross - total_deductions)
);

-- 9. LINHAS ANALÍTICAS DO RECIBO
CREATE TABLE IF NOT EXISTS kudiba_payroll.payslip_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    payslip_id UUID NOT NULL REFERENCES kudiba_payroll.payslips(id) ON DELETE RESTRICT,
    line_type VARCHAR(20) NOT NULL CHECK (line_type IN ('EARNING', 'DEDUCTION', 'EMPLOYER_COST')),
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    rate NUMERIC(7, 4) NOT NULL DEFAULT 0.0000,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. ÍNDICES DE PERFORMANCE E CONSULTA MULTI-TENANT
CREATE INDEX IF NOT EXISTS idx_dept_tenant ON kudiba_payroll.departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_tenant ON kudiba_payroll.job_positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emp_tenant ON kudiba_payroll.employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emp_status ON kudiba_payroll.employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_employee ON kudiba_payroll.contracts(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_contract_status ON kudiba_payroll.contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_period_tenant ON kudiba_payroll.payroll_periods(tenant_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payslip_period ON kudiba_payroll.payslips(tenant_id, period_id);
CREATE INDEX IF NOT EXISTS idx_payslip_employee ON kudiba_payroll.payslips(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_payslip_lines_payslip ON kudiba_payroll.payslip_lines(payslip_id);
