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
    pub internal_gateway_secret: String,
    pub enforce_gateway_signature: bool,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let http_port = env::var("PORT")
            .unwrap_or_else(|_| "8084".to_string())
            .parse::<u16>()
            .unwrap_or(8084);

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://kudiba:kudiba_secret_pass@localhost:5432/kudiba_treasury".to_string()
        });

        let db_max_connections = env::var("DB_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "20".to_string())
            .parse::<u32>()
            .unwrap_or(20);

        let rabbitmq_url = env::var("RABBITMQ_URL")
            .unwrap_or_else(|_| "amqp://kudiba:kudiba_rabbit_pass@localhost:5672/%2f".to_string());

        let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());
        let is_production = environment.eq_ignore_ascii_case("production")
            || environment.eq_ignore_ascii_case("prod");

        const DEVELOPMENT_INTERNAL_GATEWAY_SECRET: &str =
            "kudiba_internal_gateway_secret_development_key_change_in_production_2026";
        let internal_gateway_secret = env::var("INTERNAL_GATEWAY_SECRET")
            .unwrap_or_else(|_| DEVELOPMENT_INTERNAL_GATEWAY_SECRET.to_string());

        let enforce_gateway_signature = env::var("ENFORCE_GATEWAY_SIGNATURE")
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        if (enforce_gateway_signature || is_production)
            && (internal_gateway_secret == DEVELOPMENT_INTERNAL_GATEWAY_SECRET
                || internal_gateway_secret.len() < 32)
        {
            panic!("INTERNAL_GATEWAY_SECRET must be an explicit, non-default secret when signature enforcement is on or in production.");
        }

        Self {
            http_port,
            database_url,
            db_max_connections,
            rabbitmq_url,
            environment,
            internal_gateway_secret,
            enforce_gateway_signature,
        }
    }

    pub async fn create_db_pool(&self) -> Result<PgPool, sqlx::Error> {
        with_tenant_hooks(
            PgPoolOptions::new()
                .max_connections(self.db_max_connections)
                .acquire_timeout(Duration::from_secs(5))
                .idle_timeout(Duration::from_secs(600)),
        )
        .connect(&self.database_url)
        .await
    }

    pub fn create_lazy_db_pool(&self) -> Result<PgPool, sqlx::Error> {
        with_tenant_hooks(
            PgPoolOptions::new()
                .max_connections(self.db_max_connections)
                .acquire_timeout(Duration::from_secs(5))
                .idle_timeout(Duration::from_secs(600)),
        )
        .connect_lazy(&self.database_url)
    }
}
