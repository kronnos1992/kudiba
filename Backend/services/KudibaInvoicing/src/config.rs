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
    /// Dimensão do pool de ligações
    pub db_max_connections: u32,
    /// Versão da chave privada RSA registada na AGT
    pub agt_key_version: String,
    /// Versão do serviço exposta nos endpoints de metadados
    pub service_version: &'static str,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        Self {
            http_port: read_port("PORT", 9090),
            grpc_port: read_port("GRPC_PORT", 9091),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://kudiba:kudiba_secret_pass@localhost:5432/kudiba_erp".to_string()
            }),
            db_max_connections: env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|value| value.parse::<u32>().ok())
                .unwrap_or(20),
            agt_key_version: env::var("AGT_KEY_VERSION").unwrap_or_else(|_| "1".to_string()),
            service_version: env!("CARGO_PKG_VERSION"),
        }
    }

    /// Pool de ligações ACID para o motor fiscal
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
