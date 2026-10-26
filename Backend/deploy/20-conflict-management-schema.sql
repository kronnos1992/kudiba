-- ============================================================================
-- Kudiba ERP: Migração 20 - Módulo de Gestão de Conflitos Laborais e Mediação (RH)
-- Base de dados: kudiba_payroll / kudiba_erp
-- Conformidade: Lei Geral do Trabalho de Angola (Lei n.º 12/23) e
-- Proteção de Dados Pessoais (Lei n.º 22/11)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_payroll;

-- 1. CASOS DE CONFLITO / OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS kudiba_payroll.conflict_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    reference_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL DEFAULT 'INTERPESSOAL',
    severity VARCHAR(30) NOT NULL DEFAULT 'MEDIA',
    status VARCHAR(40) NOT NULL DEFAULT 'EM_TRIAGEM',
    department_id UUID REFERENCES kudiba_payroll.departments(id) ON DELETE SET NULL,
    department_name VARCHAR(150),
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
    complainant_employee_id UUID REFERENCES kudiba_payroll.employees(id) ON DELETE SET NULL,
    complainant_name VARCHAR(255),
    respondent_employee_id UUID REFERENCES kudiba_payroll.employees(id) ON DELETE SET NULL,
    respondent_name VARCHAR(255),
    assigned_mediator_id VARCHAR(100),
    assigned_mediator_name VARCHAR(255),
    resolution_route VARCHAR(50) DEFAULT 'MEDIACAO',
    summary TEXT NOT NULL,
    retaliation_risk BOOLEAN NOT NULL DEFAULT FALSE,
    urgent_protection_measures TEXT,
    closure_reason TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conflict_case_ref UNIQUE (tenant_id, reference_code)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_tenant ON kudiba_payroll.conflict_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON kudiba_payroll.conflict_cases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conflicts_dept ON kudiba_payroll.conflict_cases(tenant_id, department_id);

-- 2. PARTES ENVOLVIDAS E TESTEMUNHAS
CREATE TABLE IF NOT EXISTS kudiba_payroll.conflict_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES kudiba_payroll.conflict_cases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    employee_id UUID REFERENCES kudiba_payroll.employees(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(40) NOT NULL, -- 'COMPLAINANT', 'RESPONDENT', 'WITNESS', 'MEDIATOR', 'INVESTIGATOR', 'DEPARTMENT_HEAD'
    statement TEXT,
    statement_date TIMESTAMPTZ,
    has_conflict_of_interest BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_of_interest_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflict_parts_case ON kudiba_payroll.conflict_participants(case_id);
CREATE INDEX IF NOT EXISTS idx_conflict_parts_tenant ON kudiba_payroll.conflict_participants(tenant_id);

-- 3. REUNIÕES E AUDIÊNCIAS DE MEDIAÇÃO
CREATE TABLE IF NOT EXISTS kudiba_payroll.conflict_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES kudiba_payroll.conflict_cases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    meeting_type VARCHAR(50) NOT NULL DEFAULT 'INDIVIDUAL_HEARING',
    scheduled_at TIMESTAMPTZ NOT NULL,
    location VARCHAR(200) NOT NULL DEFAULT 'Gabinete RH Confidencial',
    conducted_by VARCHAR(255) NOT NULL,
    attendees TEXT,
    minutes TEXT,
    agreed_points TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'COMPLETED', 'CANCELLED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflict_meetings_case ON kudiba_payroll.conflict_meetings(case_id);

-- 4. PLANO DE RESOLUÇÃO E AÇÕES CORRETIVAS
CREATE TABLE IF NOT EXISTS kudiba_payroll.conflict_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES kudiba_payroll.conflict_cases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL DEFAULT 'COMPROMISSO_CONDUTA',
    assigned_to VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    completion_notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflict_actions_case ON kudiba_payroll.conflict_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_conflict_actions_status ON kudiba_payroll.conflict_actions(tenant_id, status);

-- 5. ACOMPANHAMENTO PÓS-RESOLUÇÃO & PREVENÇÃO DE REINCIDÊNCIA
CREATE TABLE IF NOT EXISTS kudiba_payroll.conflict_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES kudiba_payroll.conflict_cases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reviewed_by VARCHAR(255) NOT NULL,
    feedback_complainant TEXT,
    feedback_respondent TEXT,
    retaliation_detected BOOLEAN NOT NULL DEFAULT FALSE,
    is_stable BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflict_followups_case ON kudiba_payroll.conflict_follow_ups(case_id);

-- 6. REGISTO DE AUDITORIA E CONFIDENCIALIDADE (LEI 22/11)
CREATE TABLE IF NOT EXISTS kudiba_payroll.conflict_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES kudiba_payroll.conflict_cases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflict_audit_case ON kudiba_payroll.conflict_audit_logs(case_id);
