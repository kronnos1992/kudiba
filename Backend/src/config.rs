use std::env;
use std::time::Duration;

/// Configurações carregadas do ambiente com tipagem estrita e fallbacks seguros
#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub env: String,
    pub read_timeout: Duration,
    pub write_timeout: Duration,
    pub max_body_bytes: usize,
    pub allowed_origins: String,

    pub redis_url: String,

    pub core_api_url: String,
    pub fiscal_engine_url: String,

    // Regulamentação AGT - Decreto Presidencial n.º 71/25
    pub agt_contingency_max_days: i64,
    pub agt_platform_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("GATEWAY_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .unwrap_or(8080);

        let env_mode = env::var("GATEWAY_ENV").unwrap_or_else(|_| "development".to_string());
        
        let redis_host = env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string());
        let redis_port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
        let redis_password = env::var("REDIS_PASSWORD").unwrap_or_default();
        let redis_db = env::var("REDIS_DB").unwrap_or_else(|_| "0".to_string());

        let redis_url = if redis_password.is_empty() {
            format!("redis://{}:{}/{}", redis_host, redis_port, redis_db)
        } else {
            format!("redis://:{}@{}:{}/{}", redis_password, redis_host, redis_port, redis_db)
        };

        Self {
            port,
            env: env_mode,
            read_timeout: Duration::from_secs(15),
            write_timeout: Duration::from_secs(30),
            max_body_bytes: 10 * 1024 * 1024, // 10MB
            allowed_origins: env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| "*".to_string()),
            redis_url,
            core_api_url: env::var("CORE_API_URL").unwrap_or_else(|_| "http://localhost:8081".to_string()),
            fiscal_engine_url: env::var("FISCAL_ENGINE_GRPC_TARGET").unwrap_or_else(|_| "http://localhost:9090".to_string()),
            agt_contingency_max_days: env::var("AGT_CONTINGENCY_MAX_DAYS")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<i64>()
                .unwrap_or(60),
            agt_platform_url: env::var("AGT_PLATFORM_URL")
                .unwrap_or_else(|_| "https://webservices.agt.minfin.gov.ao/facturacao-electronica".to_string()),
        }
    }
}
