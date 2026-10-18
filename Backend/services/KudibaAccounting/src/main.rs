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
        tracing::warn!("Aviso: não foi possível verificar schema inicial de contabilidade ({}).", err);
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
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_cost_center UNIQUE (tenant_id, code)
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
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
