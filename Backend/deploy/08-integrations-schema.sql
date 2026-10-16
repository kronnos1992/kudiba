-- =============================================================================
-- Kudiba ERP — Microsserviço Integration Hub (KudibaIntegrations)
-- Schema DDL: kudiba_integrations
-- Framework transversal de integrações configuráveis (webhook, REST pull e
-- importação de ficheiros). Ligar um novo sistema externo exige apenas
-- configuração via backoffice, sem qualquer alteração de código.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_integrations;

-- 1. TIPOS ENUMERADOS
DO $$ BEGIN
    CREATE TYPE kudiba_integrations.connector_type AS ENUM (
        'WEBHOOK',
        'REST_PULL',
        'FILE_IMPORT'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_integrations.data_format AS ENUM (
        'JSON',
        'CSV',
        'FIXED_WIDTH'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_integrations.auth_type AS ENUM (
        'NONE',
        'API_KEY',
        'BASIC',
        'BEARER'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_integrations.conflict_policy AS ENUM (
        'SKIP',
        'UPDATE',
        'FAIL'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_integrations.run_status AS ENUM (
        'SUCCESS',
        'PARTIAL',
        'FAILED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_integrations.run_trigger AS ENUM (
        'WEBHOOK',
        'SCHEDULE',
        'MANUAL'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. PONTO DE INTEGRAÇÃO (ligação a um sistema externo)
CREATE TABLE IF NOT EXISTS kudiba_integrations.integration_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    system_type VARCHAR(50) NOT NULL,
    connector_type kudiba_integrations.connector_type NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Autenticação (credenciais guardadas cifradas)
    auth_type kudiba_integrations.auth_type NOT NULL DEFAULT 'NONE',
    encrypted_credentials TEXT,

    -- Webhook de entrada
    webhook_key VARCHAR(80),
    webhook_header_name VARCHAR(80),
    webhook_secret VARCHAR(255),

    -- REST pull agendado
    source_url VARCHAR(500),
    http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
    request_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_interval_seconds INT,

    -- Importação de ficheiros
    data_format kudiba_integrations.data_format NOT NULL DEFAULT 'JSON',
    file_delimiter VARCHAR(5),
    file_has_header BOOLEAN NOT NULL DEFAULT TRUE,
    file_encoding VARCHAR(20) NOT NULL DEFAULT 'utf-8',
    column_widths JSONB NOT NULL DEFAULT '[]'::jsonb,

    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_endpoint_tenant_name UNIQUE (tenant_id, name)
);

-- 3. MAPEAMENTO DE CAMPOS E DESTINO (por endpoint)
CREATE TABLE IF NOT EXISTS kudiba_integrations.integration_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    endpoint_id UUID NOT NULL REFERENCES kudiba_integrations.integration_endpoints(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    record_path VARCHAR(255),
    field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
    static_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    dedup_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    conflict_policy kudiba_integrations.conflict_policy NOT NULL DEFAULT 'SKIP',
    target_event_type VARCHAR(120) NOT NULL,
    target_routing_key VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mapping_tenant_endpoint_name UNIQUE (tenant_id, endpoint_id, name)
);

-- 4. REGISTO DE EXECUÇÕES (auditoria e diagnóstico)
CREATE TABLE IF NOT EXISTS kudiba_integrations.integration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    endpoint_id UUID NOT NULL REFERENCES kudiba_integrations.integration_endpoints(id) ON DELETE CASCADE,
    mapping_id UUID REFERENCES kudiba_integrations.integration_mappings(id) ON DELETE SET NULL,
    trigger kudiba_integrations.run_trigger NOT NULL,
    status kudiba_integrations.run_status NOT NULL,
    records_received INT NOT NULL DEFAULT 0,
    records_succeeded INT NOT NULL DEFAULT 0,
    records_failed INT NOT NULL DEFAULT 0,
    records_skipped INT NOT NULL DEFAULT 0,
    message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. REGISTO DE IDEMPOTÊNCIA (deduplicação de registos ingeridos)
CREATE TABLE IF NOT EXISTS kudiba_integrations.ingested_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    mapping_id UUID NOT NULL REFERENCES kudiba_integrations.integration_mappings(id) ON DELETE CASCADE,
    dedup_hash VARCHAR(128) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ingested_dedup UNIQUE (tenant_id, mapping_id, dedup_hash)
);

-- 6. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_endpoint_tenant ON kudiba_integrations.integration_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_enabled ON kudiba_integrations.integration_endpoints(tenant_id, is_enabled, connector_type);
CREATE INDEX IF NOT EXISTS idx_mapping_endpoint ON kudiba_integrations.integration_mappings(tenant_id, endpoint_id);
CREATE INDEX IF NOT EXISTS idx_run_endpoint ON kudiba_integrations.integration_runs(tenant_id, endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingested_lookup ON kudiba_integrations.ingested_records(tenant_id, mapping_id, dedup_hash);

-- 7. SEED DE EXEMPLO (integração de controlo de assiduidade)
-- Tenants reais devem configurar via backoffice; este seed documenta o formato.
INSERT INTO kudiba_integrations.integration_endpoints (
    tenant_id, name, system_type, connector_type, description, is_enabled,
    auth_type, data_format, schedule_interval_seconds
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Relógio de Ponto Sede (Exemplo)',
    'ATTENDANCE',
    'REST_PULL',
    'Exemplo de integração de controlo de assiduidade via API REST agendada.',
    FALSE,
    'API_KEY',
    'JSON',
    300
) ON CONFLICT (tenant_id, name) DO NOTHING;
