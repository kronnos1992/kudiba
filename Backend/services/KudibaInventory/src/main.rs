use std::net::SocketAddr;
use std::time::Duration;
use tokio::signal;
use tracing::info;

use kudiba_inventory::config::Config;
use kudiba_inventory::presentation::http::create_router;
use kudiba_inventory::state::AppState;

const MAX_DB_CONNECT_ATTEMPTS: u32 = 2;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(2);

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "kudiba_inventory=info,tower_http=info".into()),
        )
        .init();

    info!("Iniciando KudibaInventory Service (Fase 2)...");

    let config = Config::from_env();
    let pool = connect_with_retry(&config).await?;
    if let Err(err) = ensure_schema(&pool).await {
        tracing::warn!(
            "Aviso: não foi possível garantir o schema kudiba_inventory ({}): continuando em modo degradado.",
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
    info!("KudibaInventory escutando em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    let _ = event_shutdown_tx.send(true);
    info!("KudibaInventory encerrado com sucesso.");
    Ok(())
}

async fn ensure_schema(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(
        r#"
        CREATE SCHEMA IF NOT EXISTS kudiba_inventory;

        DO $$ BEGIN
            CREATE TYPE kudiba_inventory.entity_kind AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_inventory.tax_id_kind AS ENUM ('LEGAL_ENTITY', 'NATURAL_PERSON_BI', 'FINAL_CONSUMER', 'FOREIGN');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_inventory.product_kind AS ENUM ('P', 'S', 'O', 'E', 'I');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE kudiba_inventory.stock_movement_kind AS ENUM (
                'IN_PURCHASE',
                'IN_TRANSFER',
                'IN_ADJUSTMENT',
                'OUT_SALE',
                'OUT_TRANSFER',
                'OUT_WASTE',
                'OUT_ADJUSTMENT'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS kudiba_inventory.entities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            entity_type kudiba_inventory.entity_kind NOT NULL DEFAULT 'CUSTOMER',
            tax_id_type kudiba_inventory.tax_id_kind NOT NULL,
            tax_id VARCHAR(30) NOT NULL,
            name VARCHAR(255) NOT NULL,
            trade_name VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(50),
            is_withholding_agent BOOLEAN NOT NULL DEFAULT FALSE,
            country_code VARCHAR(2) NOT NULL DEFAULT 'AO',
            province VARCHAR(100),
            city VARCHAR(100),
            address_detail TEXT,
            iban VARCHAR(34),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_inventory_tenant_tax_id UNIQUE (tenant_id, tax_id)
        );

        CREATE INDEX IF NOT EXISTS idx_entities_tenant ON kudiba_inventory.entities(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_tax_id ON kudiba_inventory.entities(tenant_id, tax_id);

        CREATE TABLE IF NOT EXISTS kudiba_inventory.warehouses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            branch_id UUID NOT NULL,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(150) NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            address_detail TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_inventory_warehouse_code UNIQUE (tenant_id, code)
        );

        CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_branch ON kudiba_inventory.warehouses(tenant_id, branch_id);

        CREATE TABLE IF NOT EXISTS kudiba_inventory.products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            code VARCHAR(50) NOT NULL,
            ref_id VARCHAR(100),
            barcode VARCHAR(50),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            product_type kudiba_inventory.product_kind NOT NULL DEFAULT 'P',
            is_stockable BOOLEAN NOT NULL DEFAULT TRUE,
            track_lots BOOLEAN NOT NULL DEFAULT FALSE,
            unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
            purchase_unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
            purchase_conversion_factor NUMERIC(15, 4) NOT NULL DEFAULT 1,
            sale_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
            cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
            current_cmp NUMERIC(15, 4) NOT NULL DEFAULT 0,
            tax_type VARCHAR(10) NOT NULL DEFAULT 'IVA',
            tax_code VARCHAR(10) NOT NULL DEFAULT 'NOR',
            tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 14.00,
            exemption_reason_code VARCHAR(10),
            exemption_reason_text VARCHAR(255),
            has_withholding_tax BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_inventory_product_code UNIQUE (tenant_id, code)
        );

        ALTER TABLE kudiba_inventory.products
            ADD COLUMN IF NOT EXISTS purchase_unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
            ADD COLUMN IF NOT EXISTS purchase_conversion_factor NUMERIC(15, 4) NOT NULL DEFAULT 1;

        CREATE INDEX IF NOT EXISTS idx_products_tenant ON kudiba_inventory.products(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON kudiba_inventory.products(tenant_id, barcode) WHERE barcode IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_products_ref_id ON kudiba_inventory.products(tenant_id, ref_id) WHERE ref_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_products_type ON kudiba_inventory.products(tenant_id, product_type);

        CREATE TABLE IF NOT EXISTS kudiba_inventory.stock_balances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            warehouse_id UUID NOT NULL REFERENCES kudiba_inventory.warehouses(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES kudiba_inventory.products(id) ON DELETE CASCADE,
            quantity_on_hand NUMERIC(15, 4) NOT NULL DEFAULT 0,
            quantity_reserved NUMERIC(15, 4) NOT NULL DEFAULT 0,
            reorder_point NUMERIC(15, 4) NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_inventory_product_warehouse UNIQUE (product_id, warehouse_id)
        );

        CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON kudiba_inventory.stock_balances(warehouse_id);

        CREATE TABLE IF NOT EXISTS kudiba_inventory.product_batches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            product_id UUID NOT NULL REFERENCES kudiba_inventory.products(id) ON DELETE CASCADE,
            batch_number VARCHAR(100) NOT NULL,
            manufacture_date DATE,
            expiry_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_inventory_product_batch UNIQUE (product_id, batch_number)
        );

        CREATE TABLE IF NOT EXISTS kudiba_inventory.stock_movements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            warehouse_id UUID NOT NULL REFERENCES kudiba_inventory.warehouses(id) ON DELETE RESTRICT,
            product_id UUID NOT NULL REFERENCES kudiba_inventory.products(id) ON DELETE RESTRICT,
            batch_id UUID REFERENCES kudiba_inventory.product_batches(id) ON DELETE SET NULL,
            movement_type kudiba_inventory.stock_movement_kind NOT NULL,
            quantity NUMERIC(15, 4) NOT NULL,
            unit_cost NUMERIC(15, 4) NOT NULL,
            total_cost NUMERIC(15, 4) NOT NULL,
            resulting_cmp NUMERIC(15, 4) NOT NULL,
            document_ref VARCHAR(50),
            notes TEXT,
            created_by UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON kudiba_inventory.stock_movements(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON kudiba_inventory.stock_movements(product_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON kudiba_inventory.stock_movements(warehouse_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON kudiba_inventory.stock_movements(created_at DESC);
        "#,
    )
    .execute(pool)
    .await?;

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
                    "Aviso: falha inicial na ligação ao PostgreSQL ({}). KudibaInventory em modo degradado.",
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
