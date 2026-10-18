use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::env;
use std::time::Duration;

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
        PgPoolOptions::new()
            .max_connections(self.db_max_connections)
            .acquire_timeout(Duration::from_secs(5))
            .connect(&self.database_url)
            .await
    }

    pub fn create_lazy_db_pool(&self) -> Result<PgPool, sqlx::Error> {
        PgPoolOptions::new()
            .max_connections(self.db_max_connections)
            .acquire_timeout(Duration::from_secs(5))
            .connect_lazy(&self.database_url)
    }
}
