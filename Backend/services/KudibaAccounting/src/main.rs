use std::net::SocketAddr;
use std::time::Duration;
use tokio::signal;
use tracing::info;

use kudiba_accounting::config::Config;
use kudiba_accounting::presentation::http::create_router;
use kudiba_accounting::state::AppState;

const MAX_DB_CONNECT_ATTEMPTS: u32 = 2;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(2);

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "kudiba_accounting=info,tower_http=info".into()),
        )
        .init();

    info!("Iniciando KudibaAccounting Service (Contabilidade Geral & PGC de Angola)...");

    let config = Config::from_env();
    let pool = connect_with_retry(&config).await?;
    if let Err(err) = ensure_schema(&pool).await {
        tracing::warn!(
            "Aviso: não foi possível verificar schema inicial de contabilidade ({}).",
            err
        );
    }

    let app_state = AppState::new(config.clone(), pool);

    let (event_shutdown_tx, event_shutdown_rx) = tokio::sync::watch::channel(false);
    let event_consumer = app_state.event_consumer.clone();
    tokio::spawn(async move {
        event_consumer.run_loop(event_shutdown_rx).await;
    });

    let app = create_router(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.http_port));
    info!("KudibaAccounting escutando em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    let _ = event_shutdown_tx.send(true);
    info!("KudibaAccounting encerrado com sucesso.");
    Ok(())
}

async fn connect_with_retry(config: &Config) -> Result<sqlx::PgPool, sqlx::Error> {
    let mut attempt = 1;
    loop {
        match config.create_db_pool().await {
            Ok(pool) => {
                info!("Pool de conexões PostgreSQL estabelecido com sucesso.");
                return Ok(pool);
            }
            Err(err) if attempt < MAX_DB_CONNECT_ATTEMPTS => {
                tracing::warn!(
                    attempt,
                    max_attempts = MAX_DB_CONNECT_ATTEMPTS,
                    "Não foi possível ligar ao PostgreSQL ({}). Nova tentativa em {}s.",
                    err,
                    DB_CONNECT_RETRY_DELAY.as_secs()
                );
                attempt += 1;
                tokio::time::sleep(DB_CONNECT_RETRY_DELAY).await;
            }
            Err(err) => {
                tracing::warn!(
                    "Aviso: falha inicial na ligação ao PostgreSQL ({}). KudibaAccounting em modo degradado.",
                    err
                );
                return config.create_lazy_db_pool();
            }
        }
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("falha ao instalar handler de Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("falha ao instalar handler de SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

async fn ensure_schema(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(
        r#"
        CREATE SCHEMA IF NOT EXISTS kudiba_accounting;

        DO $$ BEGIN
            CREATE TYPE kudiba_accounting.fiscal_year_status AS ENUM ('OPEN', 'CLOSING_IN_PROGRESS', 'CLOSED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_accounting.account_class AS ENUM (
                'CLASS_1_MEIOS_FINANCEIROS',
                'CLASS_2_EXISTENCIAS',
                'CLASS_3_TERCEIROS',
                'CLASS_4_IMOBILIZACOES',
                'CLASS_5_CAPITAL_PROPRIO',
                'CLASS_6_CUSTOS',
                'CLASS_7_PROVEITOS',
                'CLASS_8_RESULTADOS'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_accounting.account_nature AS ENUM ('DEBIT', 'CREDIT');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_accounting.journal_type AS ENUM (
                'SALES',
                'PURCHASES',
                'CASH',
                'BANK',
                'OPERATIONS',
                'CLOSING'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_accounting.entry_status AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS kudiba_accounting.fiscal_years (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            year_code INT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status kudiba_accounting.fiscal_year_status NOT NULL DEFAULT 'OPEN',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_fiscal_year UNIQUE (tenant_id, year_code)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.chart_of_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            account_code VARCHAR(30) NOT NULL,
            parent_account_code VARCHAR(30),
            account_name VARCHAR(255) NOT NULL,
            account_class kudiba_accounting.account_class NOT NULL,
            account_nature kudiba_accounting.account_nature NOT NULL,
            is_analytical BOOLEAN NOT NULL DEFAULT TRUE,
            is_system_reserved BOOLEAN NOT NULL DEFAULT FALSE,
            saft_grouping_code VARCHAR(30),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_account_code UNIQUE (tenant_id, account_code)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_centers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            code VARCHAR(30) NOT NULL,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            parent_cost_center_id UUID REFERENCES kudiba_accounting.cost_centers(id) ON DELETE SET NULL,
            center_type VARCHAR(30) NOT NULL DEFAULT 'COST_CENTER',
            branch_name VARCHAR(120) NOT NULL DEFAULT 'Sede - Luanda',
            department_name VARCHAR(120),
            responsible_employee_id UUID,
            responsible_name VARCHAR(150),
            valid_from DATE NOT NULL DEFAULT '2026-01-01',
            valid_to DATE,
            monthly_budget NUMERIC(18, 4) NOT NULL DEFAULT 0,
            alert_threshold_pct NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_cost_center UNIQUE (tenant_id, code)
        );

        ALTER TABLE kudiba_accounting.cost_centers
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS parent_cost_center_id UUID REFERENCES kudiba_accounting.cost_centers(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS center_type VARCHAR(30) NOT NULL DEFAULT 'COST_CENTER',
            ADD COLUMN IF NOT EXISTS branch_name VARCHAR(120) NOT NULL DEFAULT 'Sede - Luanda',
            ADD COLUMN IF NOT EXISTS department_name VARCHAR(120),
            ADD COLUMN IF NOT EXISTS responsible_employee_id UUID,
            ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(150),
            ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT '2026-01-01',
            ADD COLUMN IF NOT EXISTS valid_to DATE,
            ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(18, 4) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS alert_threshold_pct NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_center_budgets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE CASCADE,
            fiscal_year INT NOT NULL,
            period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
            account_category VARCHAR(80) NOT NULL DEFAULT 'GERAL',
            approved_budget NUMERIC(18, 4) NOT NULL DEFAULT 0,
            committed_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
            alert_80_pct BOOLEAN NOT NULL DEFAULT TRUE,
            alert_90_pct BOOLEAN NOT NULL DEFAULT TRUE,
            alert_100_pct BOOLEAN NOT NULL DEFAULT TRUE,
            notes TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_cost_center_budget_period UNIQUE (tenant_id, cost_center_id, fiscal_year, period_month, account_category)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_allocation_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            code VARCHAR(40) NOT NULL,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            allocation_basis VARCHAR(60) NOT NULL DEFAULT 'CONSUMO_ESTIMADO',
            default_account_code VARCHAR(30),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_allocation_rule UNIQUE (tenant_id, code)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_allocation_rule_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rule_id UUID NOT NULL REFERENCES kudiba_accounting.cost_allocation_rules(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL,
            cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
            percentage NUMERIC(6, 2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
            justification VARCHAR(200)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.journals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            code VARCHAR(10) NOT NULL,
            name VARCHAR(100) NOT NULL,
            journal_type kudiba_accounting.journal_type NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_journal_code UNIQUE (tenant_id, code)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.accounting_sequences (
            tenant_id UUID NOT NULL,
            journal_code VARCHAR(10) NOT NULL,
            fiscal_year INT NOT NULL,
            current_number BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (tenant_id, journal_code, fiscal_year)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.journal_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            fiscal_year_id UUID NOT NULL REFERENCES kudiba_accounting.fiscal_years(id),
            journal_id UUID NOT NULL REFERENCES kudiba_accounting.journals(id),
            entry_number BIGINT NOT NULL,
            transaction_date DATE NOT NULL,
            system_entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            period INT NOT NULL CHECK (period BETWEEN 1 AND 14),
            description TEXT NOT NULL,
            source_service VARCHAR(50),
            source_document_type VARCHAR(20),
            source_document_id UUID,
            source_document_ref VARCHAR(100),
            total_debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
            total_credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
            status kudiba_accounting.entry_status NOT NULL DEFAULT 'POSTED',
            reversal_of_entry_id UUID REFERENCES kudiba_accounting.journal_entries(id),
            hash VARCHAR(64),
            created_by UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_journal_entry UNIQUE (tenant_id, journal_id, fiscal_year_id, entry_number),
            CONSTRAINT chk_balanced_entry CHECK (total_debit = total_credit)
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.journal_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            entry_id UUID NOT NULL REFERENCES kudiba_accounting.journal_entries(id) ON DELETE RESTRICT,
            line_number INT NOT NULL,
            account_code VARCHAR(30) NOT NULL,
            description TEXT,
            debit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
            credit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
            entity_id UUID,
            cost_center_id UUID REFERENCES kudiba_accounting.cost_centers(id),
            project_id UUID,
            currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
            exchange_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
            foreign_amount NUMERIC(18, 4),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_entry_line UNIQUE (entry_id, line_number),
            CONSTRAINT chk_positive_line CHECK (debit_amount >= 0 AND credit_amount >= 0),
            CONSTRAINT chk_single_sided CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.processed_events (
            event_id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            source_ref VARCHAR(100) NOT NULL,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_center_allocations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            batch_id UUID NOT NULL,
            tracking_scope VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTO',
            source_module VARCHAR(40) NOT NULL DEFAULT 'CONTABILIDADE',
            source_document_ref VARCHAR(100) NOT NULL,
            supplier_name VARCHAR(180),
            purchase_order_ref VARCHAR(80),
            receipt_delivery_ref VARCHAR(80),
            payment_settlement_ref VARCHAR(80),
            journal_entry_ref VARCHAR(80),
            journal_entry_id UUID REFERENCES kudiba_accounting.journal_entries(id) ON DELETE SET NULL,
            allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
            period_month INT NOT NULL DEFAULT 10,
            fiscal_year INT NOT NULL DEFAULT 2026,
            account_code VARCHAR(30) NOT NULL,
            account_name VARCHAR(255) NOT NULL,
            is_capex BOOLEAN NOT NULL DEFAULT FALSE,
            cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
            branch_name VARCHAR(120) NOT NULL DEFAULT 'Sede - Luanda',
            project_code VARCHAR(80),
            vehicle_or_asset VARCHAR(80),
            allocation_rule_id UUID REFERENCES kudiba_accounting.cost_allocation_rules(id) ON DELETE SET NULL,
            allocation_criterion VARCHAR(150),
            percentage NUMERIC(6, 2) NOT NULL DEFAULT 100.00,
            allocated_amount NUMERIC(18, 4) NOT NULL,
            total_document_amount NUMERIC(18, 4) NOT NULL,
            total_units NUMERIC(12, 2),
            allocated_units NUMERIC(12, 2),
            unit_measure VARCHAR(40),
            asset_tags VARCHAR(255),
            recipient_responsible VARCHAR(150),
            useful_life_months INT,
            monthly_depreciation NUMERIC(18, 4) NOT NULL DEFAULT 0,
            notes TEXT,
            created_by VARCHAR(100) NOT NULL DEFAULT 'Contabilista Chefe',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE kudiba_accounting.cost_center_allocations
            ADD COLUMN IF NOT EXISTS tracking_scope VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTO',
            ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(180),
            ADD COLUMN IF NOT EXISTS purchase_order_ref VARCHAR(80),
            ADD COLUMN IF NOT EXISTS receipt_delivery_ref VARCHAR(80),
            ADD COLUMN IF NOT EXISTS payment_settlement_ref VARCHAR(80),
            ADD COLUMN IF NOT EXISTS journal_entry_ref VARCHAR(80),
            ADD COLUMN IF NOT EXISTS total_units NUMERIC(12, 2),
            ADD COLUMN IF NOT EXISTS allocated_units NUMERIC(12, 2),
            ADD COLUMN IF NOT EXISTS unit_measure VARCHAR(40),
            ADD COLUMN IF NOT EXISTS asset_tags VARCHAR(255),
            ADD COLUMN IF NOT EXISTS recipient_responsible VARCHAR(150),
            ADD COLUMN IF NOT EXISTS useful_life_months INT,
            ADD COLUMN IF NOT EXISTS monthly_depreciation NUMERIC(18, 4) NOT NULL DEFAULT 0;

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_tracking_reclassifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            allocation_id UUID REFERENCES kudiba_accounting.cost_center_allocations(id) ON DELETE SET NULL,
            batch_id UUID NOT NULL,
            source_document_ref VARCHAR(100) NOT NULL,
            from_cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
            to_cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
            transferred_units NUMERIC(12, 2),
            transferred_amount NUMERIC(18, 4) NOT NULL,
            asset_tags_moved VARCHAR(255),
            reason TEXT NOT NULL,
            performed_by VARCHAR(120) NOT NULL DEFAULT 'Dr. António Manuel (OCPCA)',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_center_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            cost_center_id UUID REFERENCES kudiba_accounting.cost_centers(id) ON DELETE SET NULL,
            action VARCHAR(60) NOT NULL,
            entity_ref VARCHAR(120) NOT NULL,
            details TEXT NOT NULL,
            performed_by VARCHAR(120) NOT NULL DEFAULT 'Admin / Contabilista',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
