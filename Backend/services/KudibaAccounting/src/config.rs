use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::env;
use std::time::Duration;
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
    pub rabbitmq_url: String,
    pub environment: String,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let http_port = env::var("PORT")
            .unwrap_or_else(|_| "8085".to_string())
            .parse::<u16>()
            .unwrap_or(8085);

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://kudiba:kudiba_secret_pass@localhost:5432/kudiba_accounting".to_string()
        });

        let db_max_connections = env::var("DB_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "20".to_string())
            .parse::<u32>()
            .unwrap_or(20);

        let rabbitmq_url = env::var("RABBITMQ_URL")
            .unwrap_or_else(|_| "amqp://kudiba:kudiba_rabbit_pass@localhost:5672/%2f".to_string());

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
