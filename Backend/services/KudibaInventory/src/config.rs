use std::env;
use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

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
        PgPoolOptions::new()
            .max_connections(self.db_max_connections)
            .acquire_timeout(Duration::from_secs(5))
            .connect(&self.database_url)
            .await
    }
}
