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
    pub auth_service_url: String,

    pub jwt_secret: String,

    // Regulamentação AGT - Decreto Presidencial n.º 71/25
    pub agt_contingency_max_days: i64,
    pub agt_platform_url: String,

    // Infraestrutura de Serviços
    pub postgres_host: String,
    pub postgres_port: u16,
    pub rabbitmq_host: String,
    pub rabbitmq_port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("GATEWAY_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .unwrap_or(8080);

        let env_mode = env::var("GATEWAY_ENV").unwrap_or_else(|_| "development".to_string());

        let read_timeout_secs = env::var("GATEWAY_READ_TIMEOUT")
            .unwrap_or_else(|_| "15".to_string())
            .trim_end_matches('s')
            .parse::<u64>()
            .unwrap_or(15);

        let write_timeout_secs = env::var("GATEWAY_WRITE_TIMEOUT")
            .unwrap_or_else(|_| "30".to_string())
            .trim_end_matches('s')
            .parse::<u64>()
            .unwrap_or(30);

        let max_body_bytes = env::var("GATEWAY_MAX_BODY_BYTES")
            .unwrap_or_else(|_| "10485760".to_string())
            .parse::<usize>()
            .unwrap_or(10 * 1024 * 1024);

        let redis_host = env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string());
        let redis_port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
        let redis_password = env::var("REDIS_PASSWORD").unwrap_or_default();
        let redis_db = env::var("REDIS_DB").unwrap_or_else(|_| "0".to_string());

        let redis_url = if redis_password.is_empty() {
            format!("redis://{}:{}/{}", redis_host, redis_port, redis_db)
        } else {
            format!(
                "redis://:{}@{}:{}/{}",
                redis_password, redis_host, redis_port, redis_db
            )
        };

        let mut core_api_url =
            env::var("CORE_API_URL").unwrap_or_else(|_| "http://localhost:8081".to_string());
        if !core_api_url.starts_with("http://") && !core_api_url.starts_with("https://") {
            core_api_url = format!("http://{}", core_api_url);
        }

        let mut fiscal_engine_url = env::var("FISCAL_ENGINE_URL")
            .or_else(|_| env::var("FISCAL_ENGINE_GRPC_TARGET"))
            .unwrap_or_else(|_| "http://localhost:9090".to_string());
        if !fiscal_engine_url.starts_with("http://") && !fiscal_engine_url.starts_with("https://") {
            fiscal_engine_url = format!("http://{}", fiscal_engine_url);
        }

        let mut auth_service_url = env::var("AUTH_SERVICE_URL")
            .unwrap_or_else(|_| "http://localhost:8082".to_string());
        if !auth_service_url.starts_with("http://") && !auth_service_url.starts_with("https://") {
            auth_service_url = format!("http://{}", auth_service_url);
        }

        const DEVELOPMENT_JWT_SECRET: &str =
            "kudiba_jwt_secret_development_key_change_in_production_2026";
        let is_production =
            env_mode.eq_ignore_ascii_case("production") || env_mode.eq_ignore_ascii_case("prod");
        let allowed_origins = env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| {
            if is_production {
                panic!("CORS_ALLOWED_ORIGINS must be configured in production.");
            }
            "*".to_string()
        });
        if is_production {
            let origins = if allowed_origins.trim_start().starts_with('[') {
                serde_json::from_str::<Vec<String>>(&allowed_origins)
                    .unwrap_or_else(|_| panic!("CORS_ALLOWED_ORIGINS must be a JSON array or comma-separated list."))
            } else {
                allowed_origins.split(',').map(|origin| origin.trim().to_string()).collect()
            };
            if origins.is_empty()
                || origins.iter().any(|origin| {
                    let origin = origin.to_ascii_lowercase();
                    origin.is_empty()
                        || origin == "*"
                        || origin.contains("localhost")
                        || origin.contains("127.0.0.1")
                })
            {
                panic!("Production CORS_ALLOWED_ORIGINS must contain explicit, non-local origins.");
            }
        }
        let jwt_secret = match env::var("JWT_SECRET") {
            Ok(secret) => secret,
            Err(_) if is_production => {
                panic!("JWT_SECRET must be configured in production.")
            }
            Err(_) => DEVELOPMENT_JWT_SECRET.to_string(),
        };
        if is_production
            && (jwt_secret == DEVELOPMENT_JWT_SECRET || jwt_secret.as_bytes().len() < 32)
        {
            panic!("Production JWT_SECRET must be a non-default secret of at least 32 bytes.");
        }

        let (postgres_host, postgres_port) = parse_postgres_config();
        let (rabbitmq_host, rabbitmq_port) = parse_rabbitmq_config();

        Self {
            port,
            env: env_mode,
            read_timeout: Duration::from_secs(read_timeout_secs),
            write_timeout: Duration::from_secs(write_timeout_secs),
            max_body_bytes,
            allowed_origins,
            redis_url,
            core_api_url,
            fiscal_engine_url,
            auth_service_url,
            jwt_secret,
            agt_contingency_max_days: env::var("AGT_CONTINGENCY_MAX_DAYS")
                .unwrap_or_else(|_| "60".to_string())
                .parse::<i64>()
                .unwrap_or(60),
            agt_platform_url: env::var("AGT_PLATFORM_URL").unwrap_or_else(|_| {
                "https://webservices.agt.minfin.gov.ao/facturacao-electronica".to_string()
            }),
            postgres_host,
            postgres_port,
            rabbitmq_host,
            rabbitmq_port,
        }
    }
}

fn parse_postgres_config() -> (String, u16) {
    if let Ok(host) = env::var("POSTGRES_HOST") {
        let port = env::var("POSTGRES_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(5432);
        return (host, port);
    }

    if let Some(hp) = host_from_url("DATABASE_URL", 5432) {
        return hp;
    }

    ("localhost".to_string(), 5432)
}

fn parse_rabbitmq_config() -> (String, u16) {
    if let Ok(host) = env::var("RABBITMQ_HOST") {
        let port = env::var("RABBITMQ_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(5672);
        return (host, port);
    }

    if let Some(hp) = host_from_url("RABBITMQ_URL", 5672) {
        return hp;
    }

    ("localhost".to_string(), 5672)
}

/// Extrai `host` e `port` de uma URL `scheme://[user:pass@]host[:port]/caminho`.
fn host_from_url(var: &str, default_port: u16) -> Option<(String, u16)> {
    let url = env::var(var).ok()?;
    let host_port = url.split('@').nth(1)?.split('/').next()?;
    if host_port.is_empty() {
        return None;
    }
    match host_port.split_once(':') {
        Some((h, p)) => Some((h.to_string(), p.parse().unwrap_or(default_port))),
        None => Some((host_port.to_string(), default_port)),
    }
}
