-- =============================================================================
-- 11. ALINHAMENTO DO SCHEMA kudiba_core.tenants
-- As colunas cadastrais/fiscais do tenant existiam de forma fragmentada entre
-- as bases kudiba_auth e kudiba_erp (usada pelo motor fiscal KudibaInvoicing).
-- Esta migração garante que TODAS as bases têm o schema completo, adicionando
-- as colunas em falta de forma idempotente.
-- =============================================================================
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS province VARCHAR(128),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(64),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS logo_data_url TEXT,
    ADD COLUMN IF NOT EXISTS commercial_registry VARCHAR(64),
    ADD COLUMN IF NOT EXISTS share_capital VARCHAR(64),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    ADD COLUMN IF NOT EXISTS tax_office_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS agt_cert_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS default_withholding_rate NUMERIC(5, 2) NOT NULL DEFAULT 6.50,
    ADD COLUMN IF NOT EXISTS invoice_footer_notes TEXT,
    ADD COLUMN IF NOT EXISTS bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS contingency_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS license_valid_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subscribed_modules TEXT[];
