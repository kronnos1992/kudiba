use std::env;
use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use uuid::Uuid;

tokio::task_local! {
    pub static TENANT_CONTEXT: Option<Uuid>;
}

pub fn current_tenant() -> Option<Uuid> {
    TENANT_CONTEXT.try_with(|tenant| *tenant).ok().flatten()
}

pub async fn with_tenant_context<F>(tenant: Option<Uuid>, future: F) -> F::Output
where
    F: std::future::Future,
{
    TENANT_CONTEXT.scope(tenant, future).await
}

async fn set_tenant_on_connection(
    conn: &mut sqlx::PgConnection,
    tenant: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    let value = tenant.map(|id| id.to_string()).unwrap_or_default();
    sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
        .bind(value)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

fn with_tenant_hooks(options: PgPoolOptions) -> PgPoolOptions {
    options
        .after_connect(|conn, _meta| {
            Box::pin(async move { set_tenant_on_connection(conn, current_tenant()).await })
        })
        .before_acquire(|conn, _meta| {
            Box::pin(async move {
                set_tenant_on_connection(conn, current_tenant()).await?;
                Ok(true)
            })
        })
}

#[derive(Debug, Clone)]
pub struct Config {
    pub http_port: u16,
    pub database_url: String,
    pub db_max_connections: u32,
    pub rabbitmq_url: Option<String>,
    pub environment: String,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let http_port = env::var("INVENTORY_PORT")
            .or_else(|_| env::var("PORT"))
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8083);

        let database_url = env::var("INVENTORY_DATABASE_URL")
            .or_else(|_| env::var("DATABASE_URL"))
            .unwrap_or_else(|_| {
                "postgres://kudiba:kudiba_secret_pass@127.0.0.1:5432/kudiba_inventory".to_string()
            });

        let db_max_connections = env::var("DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|c| c.parse().ok())
            .unwrap_or(10);

        let rabbitmq_url = env::var("RABBITMQ_URL")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());

        Self {
            http_port,
            database_url,
            db_max_connections,
            rabbitmq_url,
            environment,
        }
    }

    pub async fn create_db_pool(&self) -> Result<PgPool, sqlx::Error> {
        with_tenant_hooks(
            PgPoolOptions::new()
                .max_connections(self.db_max_connections)
                .acquire_timeout(Duration::from_secs(5)),
        )
        .connect(&self.database_url)
        .await
    }

    pub fn create_lazy_db_pool(&self) -> Result<PgPool, sqlx::Error> {
        with_tenant_hooks(
            PgPoolOptions::new()
                .max_connections(self.db_max_connections)
                .acquire_timeout(Duration::from_secs(5)),
        )
        .connect_lazy(&self.database_url)
    }
}
