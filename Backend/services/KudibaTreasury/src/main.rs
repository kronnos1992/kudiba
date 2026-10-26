use std::net::SocketAddr;
use std::time::Duration;
use tokio::signal;
use tracing::info;

use kudiba_treasury::config::Config;
use kudiba_treasury::presentation::http::create_router;
use kudiba_treasury::state::AppState;

const MAX_DB_CONNECT_ATTEMPTS: u32 = 2;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(2);

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "kudiba_treasury=info,tower_http=info".into()),
        )
        .init();

    info!("Iniciando KudibaTreasury Service (Tesouraria, Caixa e Liquidações)...");

    let config = Config::from_env();
    let pool = connect_with_retry(&config).await?;
    if let Err(err) = ensure_schema(&pool).await {
        tracing::warn!(
            "Aviso: não foi possível verificar schema inicial de tesouraria ({}).",
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
    info!("KudibaTreasury escutando em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    let _ = event_shutdown_tx.send(true);
    info!("KudibaTreasury encerrado com sucesso.");
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
                    "Aviso: falha inicial na ligação ao PostgreSQL ({}). KudibaTreasury em modo degradado.",
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
        CREATE SCHEMA IF NOT EXISTS kudiba_treasury;

        DO $$ BEGIN
            CREATE TYPE kudiba_treasury.session_status AS ENUM ('OPEN', 'CLOSED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_treasury.movement_type AS ENUM ('SUPPLY', 'BLEED', 'SALE_RECEIPT', 'EXPENSE');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_treasury.payment_method AS ENUM ('NUMERARIO', 'MULTICAIXA', 'TRANSFERENCIA', 'GPO_REFERENCE');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_treasury.currency_code AS ENUM ('AOA', 'USD', 'EUR');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_registers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            branch_id UUID,
            code VARCHAR(30) NOT NULL,
            name VARCHAR(150) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_treasury_register_code UNIQUE (tenant_id, code)
        );
        CREATE INDEX IF NOT EXISTS idx_registers_tenant ON kudiba_treasury.cash_registers(tenant_id);

        CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            register_id UUID NOT NULL REFERENCES kudiba_treasury.cash_registers(id) ON DELETE RESTRICT,
            operator_user_id VARCHAR(100) NOT NULL,
            opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            closed_at TIMESTAMPTZ,
            opening_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
            closing_balance_counted NUMERIC(15, 4),
            closing_balance_system NUMERIC(15, 4),
            discrepancy NUMERIC(15, 4),
            status kudiba_treasury.session_status NOT NULL DEFAULT 'OPEN',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON kudiba_treasury.cash_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_register ON kudiba_treasury.cash_sessions(register_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON kudiba_treasury.cash_sessions(register_id, status);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_open_session_per_register ON kudiba_treasury.cash_sessions (tenant_id, register_id) WHERE status = 'OPEN';

        CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            register_id UUID NOT NULL REFERENCES kudiba_treasury.cash_registers(id) ON DELETE RESTRICT,
            opened_by VARCHAR(100) NOT NULL,
            opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            closed_by VARCHAR(100),
            closed_at TIMESTAMPTZ,
            closing_notes TEXT,
            status kudiba_treasury.session_status NOT NULL DEFAULT 'OPEN',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_pos_sessions_tenant ON kudiba_treasury.pos_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_pos_sessions_register ON kudiba_treasury.pos_sessions(register_id);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_open_pos_session_per_register ON kudiba_treasury.pos_sessions (tenant_id, register_id) WHERE status = 'OPEN';

        ALTER TABLE kudiba_treasury.cash_sessions
            ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES kudiba_treasury.pos_sessions(id);
        CREATE INDEX IF NOT EXISTS idx_sessions_pos ON kudiba_treasury.cash_sessions(pos_session_id);

        CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_movements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            session_id UUID NOT NULL REFERENCES kudiba_treasury.cash_sessions(id) ON DELETE RESTRICT,
            register_id UUID NOT NULL REFERENCES kudiba_treasury.cash_registers(id) ON DELETE RESTRICT,
            movement_type kudiba_treasury.movement_type NOT NULL,
            amount NUMERIC(15, 4) NOT NULL,
            reason TEXT NOT NULL,
            operator_user_id VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_movements_tenant ON kudiba_treasury.cash_movements(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_movements_session ON kudiba_treasury.cash_movements(session_id);
        CREATE INDEX IF NOT EXISTS idx_movements_register ON kudiba_treasury.cash_movements(register_id);

        CREATE TABLE IF NOT EXISTS kudiba_treasury.bank_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            bank_name VARCHAR(150) NOT NULL,
            account_number VARCHAR(50) NOT NULL,
            iban VARCHAR(34) NOT NULL,
            currency kudiba_treasury.currency_code NOT NULL DEFAULT 'AOA',
            current_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_treasury_bank_iban UNIQUE (tenant_id, iban)
        );
        CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON kudiba_treasury.bank_accounts(tenant_id);

        CREATE TABLE IF NOT EXISTS kudiba_treasury.treasury_receipts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            receipt_number VARCHAR(50) NOT NULL,
            customer_id VARCHAR(100) NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            customer_nif VARCHAR(30),
            session_id UUID REFERENCES kudiba_treasury.cash_sessions(id) ON DELETE SET NULL,
            bank_account_id UUID REFERENCES kudiba_treasury.bank_accounts(id) ON DELETE SET NULL,
            payment_method kudiba_treasury.payment_method NOT NULL,
            total_amount NUMERIC(15, 4) NOT NULL,
            currency kudiba_treasury.currency_code NOT NULL DEFAULT 'AOA',
            notes TEXT,
            issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_treasury_receipt_number UNIQUE (tenant_id, receipt_number)
        );
        CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON kudiba_treasury.treasury_receipts(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_receipts_customer ON kudiba_treasury.treasury_receipts(tenant_id, customer_id);

        CREATE TABLE IF NOT EXISTS kudiba_treasury.treasury_receipt_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            receipt_id UUID NOT NULL REFERENCES kudiba_treasury.treasury_receipts(id) ON DELETE CASCADE,
            invoice_id VARCHAR(100) NOT NULL,
            invoice_number VARCHAR(60) NOT NULL,
            amount_settled NUMERIC(15, 4) NOT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON kudiba_treasury.treasury_receipt_lines(receipt_id);
        CREATE INDEX IF NOT EXISTS idx_receipt_lines_invoice ON kudiba_treasury.treasury_receipt_lines(invoice_id);

        CREATE TABLE IF NOT EXISTS kudiba_treasury.treasury_sequences (
            tenant_id UUID NOT NULL,
            sequence_type VARCHAR(30) NOT NULL,
            fiscal_year INT NOT NULL,
            current_number BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (tenant_id, sequence_type, fiscal_year)
        );

        CREATE TABLE IF NOT EXISTS kudiba_treasury.invoice_receivables (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            invoice_id VARCHAR(100) NOT NULL,
            document_number VARCHAR(60) NOT NULL,
            document_type VARCHAR(10) NOT NULL,
            payment_mechanism VARCHAR(40),
            gross_total NUMERIC(15, 4) NOT NULL DEFAULT 0,
            paid_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
            remaining_amount NUMERIC(15, 4),
            status VARCHAR(20) NOT NULL DEFAULT 'OUTSTANDING',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_treasury_receivable_invoice UNIQUE (tenant_id, invoice_id)
        );
        ALTER TABLE kudiba_treasury.invoice_receivables ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 4) NOT NULL DEFAULT 0;
        ALTER TABLE kudiba_treasury.invoice_receivables ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(15, 4);
        CREATE INDEX IF NOT EXISTS idx_receivables_tenant ON kudiba_treasury.invoice_receivables(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_receivables_status ON kudiba_treasury.invoice_receivables(tenant_id, status);
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}
