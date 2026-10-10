use std::env;
use std::str::FromStr;
use std::time::Duration;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;

/// Configuração do Motor Fiscal carregada do ambiente
#[derive(Debug, Clone)]
pub struct Config {
    /// Porta do servidor REST interno (reverse proxy do Gateway)
    pub http_port: u16,
    /// Porta do servidor gRPC (`kudiba.fiscal.v1`)
    pub grpc_port: u16,
    /// Ligação ao PostgreSQL 16+ (URL ou keyword ADO)
    pub database_url: String,
    /// Ligação opcional a réplica de leitura do PostgreSQL (DATABASE_READ_URL)
    pub database_read_url: Option<String>,
    /// Dimensão do pool de ligações
    pub db_max_connections: u32,
    /// Versão da chave privada RSA registada na AGT
    pub agt_key_version: String,
    /// Número de validação / certificação do software na AGT (ex: 999/AGT/2026)
    pub agt_software_cert: String,
    /// Caminho opcional do ficheiro PEM da chave privada RSA da AGT
    pub agt_private_key_path: Option<String>,
    /// Conteúdo PEM direto da chave privada RSA da AGT (opcional)
    pub agt_private_key_pem: Option<String>,
    /// URL base do webservice de Facturação Electrónica da AGT
    pub agt_platform_url: String,
    /// Intervalo de polling da transactional outbox (em milissegundos)
    pub outbox_poll_interval_ms: u64,
    /// Dimensão máxima do lote de eventos a despachar por ciclo
    pub outbox_batch_size: i64,
    /// URL opcional de ligação ao RabbitMQ (ex: amqp://guest:guest@localhost:5672)
    pub rabbitmq_url: Option<String>,
    /// Lista opcional de brokers Kafka / Redpanda (ex: localhost:9092)
    pub kafka_brokers: Option<String>,
    /// Ambiente de execução (development, staging, production)
    pub environment: String,
    /// Versão do serviço exposta nos endpoints de metadados
    pub service_version: &'static str,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let environment = env::var("ENVIRONMENT")
            .or_else(|_| env::var("APP_ENV"))
            .unwrap_or_else(|_| "development".to_string())
            .to_lowercase();

        Self {
            http_port: read_port("PORT", 9090),
            grpc_port: read_port("GRPC_PORT", 9091),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://kudiba:kudiba_secret_pass@localhost:5432/kudiba_erp".to_string()
            }),
            database_read_url: env::var("DATABASE_READ_URL")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            db_max_connections: env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|value| value.parse::<u32>().ok())
                .unwrap_or(20),
            agt_key_version: env::var("AGT_KEY_VERSION").unwrap_or_else(|_| "1".to_string()),
            agt_software_cert: env::var("AGT_SOFTWARE_CERT").unwrap_or_else(|_| "999/AGT/2026".to_string()),
            agt_private_key_path: env::var("AGT_RSA_PRIVATE_KEY_PATH").ok().filter(|s| !s.trim().is_empty()),
            agt_private_key_pem: env::var("AGT_RSA_PRIVATE_KEY_PEM").ok().filter(|s| !s.trim().is_empty()),
            agt_platform_url: env::var("AGT_PLATFORM_URL")
                .unwrap_or_else(|_| "https://webservices.agt.minfin.gov.ao/facturacao-electronica".to_string()),
            outbox_poll_interval_ms: env::var("OUTBOX_POLL_INTERVAL_MS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1000),
            outbox_batch_size: env::var("OUTBOX_BATCH_SIZE")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(50),
            rabbitmq_url: env::var("RABBITMQ_URL").ok().filter(|s| !s.trim().is_empty()),
            kafka_brokers: env::var("KAFKA_BROKERS").ok().filter(|s| !s.trim().is_empty()),
            environment,
            service_version: env!("CARGO_PKG_VERSION"),
        }
    }

    /// Devolve se o ambiente configurado é estritamente produção
    pub fn is_production(&self) -> bool {
        self.environment == "production" || self.environment == "prod"
    }

    /// Pool de ligações ACID para o motor fiscal (operações de escrita)
    pub fn connect_pool(&self) -> Result<PgPool, sqlx::Error> {
        let options = parse_connect_options(&self.database_url)?;

        let pool = PgPoolOptions::new()
            .max_connections(self.db_max_connections)
            .acquire_timeout(Duration::from_secs(10))
            .idle_timeout(Duration::from_secs(600))
            .max_lifetime(Duration::from_secs(1800))
            .connect_lazy_with(options);

        Ok(pool)
    }

    /// Pool de ligações para leitura (read-replica com fallback automático para a base primária)
    pub fn connect_read_pool(&self) -> Result<PgPool, sqlx::Error> {
        let read_url = self
            .database_read_url
            .as_deref()
            .unwrap_or(&self.database_url);
        let options = parse_connect_options(read_url)?;

        let pool = PgPoolOptions::new()
            .max_connections(self.db_max_connections)
            .acquire_timeout(Duration::from_secs(10))
            .idle_timeout(Duration::from_secs(600))
            .max_lifetime(Duration::from_secs(1800))
            .connect_lazy_with(options);

        Ok(pool)
    }
}

fn read_port(variable: &str, default: u16) -> u16 {
    env::var(variable)
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(default)
}

/// Constrói as opções de ligação aceitando os dois formatos em uso na plataforma:
/// URL (`postgres://utilizador:senha@host:5432/base`) e keyword ADO
/// (`Host=postgres;Port=5432;Database=kudiba_erp;Username=kudiba;Password=...`).
fn parse_connect_options(raw: &str) -> Result<PgConnectOptions, sqlx::Error> {
    if raw.contains("://") {
        return PgConnectOptions::from_str(raw);
    }

    let mut options = PgConnectOptions::new();
    let mut any = false;

    for pair in raw
        .split([';', '\n'])
        .flat_map(|chunk| chunk.split_whitespace())
    {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };

        let key = key.trim().to_lowercase();
        let value = value.trim();

        match key.as_str() {
            "host" | "server" => {
                options = options.host(value);
                any = true;
            }
            "port" => {
                if let Ok(port) = value.parse::<u16>() {
                    options = options.port(port);
                    any = true;
                }
            }
            "database" | "db" => {
                options = options.database(value);
                any = true;
            }
            "username" | "user" | "uid" => {
                options = options.username(value);
                any = true;
            }
            "password" | "pwd" => {
                options = options.password(value);
                any = true;
            }
            _ => {}
        }
    }

    if any {
        Ok(options)
    } else {
        PgConnectOptions::from_str(raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpreta_ligacao_em_formato_ado() {
        let options = parse_connect_options(
            "Host=postgres;Port=5433;Database=kudiba;Username=kudiba;Password=segredo",
        )
        .unwrap();

        assert_eq!(options.get_host(), "postgres");
        assert_eq!(options.get_port(), 5433);
        assert_eq!(options.get_database(), Some("kudiba"));
    }

    #[test]
    fn interpreta_ligacao_em_formato_url() {
        let options =
            parse_connect_options("postgres://kudiba:segredo@localhost:5432/kudiba_erp").unwrap();

        assert_eq!(options.get_host(), "localhost");
        assert_eq!(options.get_database(), Some("kudiba_erp"));
    }
}
