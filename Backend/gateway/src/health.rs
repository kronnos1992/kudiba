//! Diagnóstico de Saúde e Observabilidade de Todos os Serviços do Kudiba ERP
//!
//! Este módulo realiza verificações assíncronas concorrentes de integridade contra:
//!   1. API Gateway (auto-diagnóstico e uptime)
//!   2. Redis (Cache, Rate Limiting & Estado Efêmero)
//!   3. KudibaInvoicing (Motor Fiscal, Assinatura RSA & Decreto 71/25)
//!   4. PostgreSQL (Base de dados transacional ACID)
//!   5. RabbitMQ (Message Broker & Filas assíncronas de SAF-T)
//!   6. Core API (Módulos Comerciais e Administrativos)
//!   7. AGT Webservices (Comunicação tributária em tempo real e detecção de contingência)

use std::time::{Duration, Instant};

use chrono::Utc;
use serde::Serialize;
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::config::Config;
use crate::server::AppState;

/// Janela mínima entre duas sondagens consolidadas.
///
/// O endpoint é público e dispara 6 verificações concorrentes (incluindo uma
/// chamada externa à AGT). Sem esta memoização, um cliente em loop causaria
/// amplificação de tráfego contra os serviços internos e contra o canal
/// governamental.
const HEALTH_CACHE_TTL: Duration = Duration::from_secs(5);

/// Estado individual de saúde de um serviço
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceHealth {
    pub name: String,
    pub service_type: String, // "GATEWAY", "CACHE", "FISCAL_ENGINE", "DATABASE", "MESSAGE_BROKER", "CORE_API", "EXTERNAL_GOV"
    pub status: String,       // "HEALTHY", "DEGRADED", "UNAVAILABLE"
    pub endpoint: String,
    pub latency_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

/// Sumário consolidado de integridade
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthSummary {
    pub total: usize,
    pub healthy: usize,
    pub degraded: usize,
    pub unavailable: usize,
}

/// Metadados do API Gateway
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayInfo {
    pub version: &'static str,
    pub environment: String,
    pub port: u16,
    pub uptime_seconds: u64,
}

/// Resposta completa do endpoint consolidado de saúde dos serviços
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemHealthResponse {
    pub status: String, // "HEALTHY", "DEGRADED", "UNHEALTHY"
    pub timestamp: String,
    pub gateway: GatewayInfo,
    pub services: Vec<ServiceHealth>,
    pub summary: HealthSummary,
}

/// Executa todas as sondagens de saúde concorrentemente (em paralelo).
///
/// O resultado é memoizado durante [`HEALTH_CACHE_TTL`]; o bloqueio é mantido
/// durante a sondagem para que pedidos concorrentes esperem pela mesma
/// execução em vez de dispararem outra.
pub async fn cached_system_health(state: &AppState) -> SystemHealthResponse {
    let mut cache = state.health_cache.lock().await;

    if let Some((cached_at, report)) = cache.as_ref() {
        if cached_at.elapsed() < HEALTH_CACHE_TTL {
            return report.clone();
        }
    }

    let report = check_system_health(state).await;
    *cache = Some((Instant::now(), report.clone()));
    report
}

/// Executa todas as sondagens de saúde concorrentemente (em paralelo)
pub async fn check_system_health(state: &AppState) -> SystemHealthResponse {
    let (redis_health, fiscal_health, pg_health, rabbit_health, core_health, agt_health) = tokio::join!(
        check_redis(state),
        check_fiscal_engine(state),
        check_postgres(&state.config),
        check_rabbitmq(&state.config),
        check_core_api(state),
        check_agt_webservices(state),
    );

    let services = vec![
        redis_health,
        fiscal_health,
        pg_health,
        rabbit_health,
        core_health,
        agt_health,
    ];

    let (summary, overall_status) = aggregate(&services);

    SystemHealthResponse {
        status: overall_status,
        timestamp: Utc::now().to_rfc3339(),
        gateway: GatewayInfo {
            version: env!("CARGO_PKG_VERSION"),
            environment: state.config.env.clone(),
            port: state.config.port,
            uptime_seconds: state.start_time.elapsed().as_secs(),
        },
        services,
        summary,
    }
}

/// Serviços sem os quais o perímetro deixa de garantir as obrigações do
/// Decreto n.º 71/25 (rate limiting, identidade fiscal e emissão de faturas).
const CRITICAL_TYPES: [&str; 3] = ["CACHE", "DATABASE", "FISCAL_ENGINE"];

fn is_critical(service_type: &str) -> bool {
    CRITICAL_TYPES.contains(&service_type)
}

/// Consolida o relatório individual num estado geral do cluster.
///
/// * `HEALTHY` — todos os serviços respondem;
/// * `UNHEALTHY` — algum serviço crítico (Redis, PostgreSQL ou Motor Fiscal) está indisponível;
/// * `DEGRADED` — apenas serviços não críticos (Core API, RabbitMQ, AGT) falham ou degradam.
fn aggregate(services: &[ServiceHealth]) -> (HealthSummary, String) {
    let mut summary = HealthSummary {
        total: services.len(),
        healthy: 0,
        degraded: 0,
        unavailable: 0,
    };

    for s in services {
        match s.status.as_str() {
            "HEALTHY" => summary.healthy += 1,
            "DEGRADED" => summary.degraded += 1,
            _ => summary.unavailable += 1,
        }
    }

    let critical_down = services
        .iter()
        .any(|s| is_critical(&s.service_type) && s.status == "UNAVAILABLE");

    let overall = if summary.unavailable == 0 && summary.degraded == 0 {
        "HEALTHY"
    } else if critical_down {
        "UNHEALTHY"
    } else {
        "DEGRADED"
    };

    (summary, overall.to_string())
}

/// 1. Verificação do Redis (Cache & Rate Limiting)
async fn check_redis(state: &AppState) -> ServiceHealth {
    let start = Instant::now();
    let sanitized_endpoint = sanitize_redis_url(&state.config.redis_url);

    match state.get_redis_conn().await {
        Some(mut conn) => {
            match timeout(
                Duration::from_secs(2),
                redis::cmd("PING").query_async::<String>(&mut conn),
            )
            .await
            {
                Ok(Ok(_)) => ServiceHealth {
                    name: "Redis Cache & Rate Limiting".to_string(),
                    service_type: "CACHE".to_string(),
                    status: "HEALTHY".to_string(),
                    endpoint: sanitized_endpoint,
                    latency_ms: start.elapsed().as_millis() as u64,
                    message: Some(
                        "Ligação ativa e comando PING respondido com sucesso.".to_string(),
                    ),
                    details: None,
                },
                Ok(Err(err)) => ServiceHealth {
                    name: "Redis Cache & Rate Limiting".to_string(),
                    service_type: "CACHE".to_string(),
                    status: "UNAVAILABLE".to_string(),
                    endpoint: sanitized_endpoint,
                    latency_ms: start.elapsed().as_millis() as u64,
                    message: Some(format!("Falha ao executar comando PING no Redis: {err}")),
                    details: None,
                },
                Err(_) => ServiceHealth {
                    name: "Redis Cache & Rate Limiting".to_string(),
                    service_type: "CACHE".to_string(),
                    status: "UNAVAILABLE".to_string(),
                    endpoint: sanitized_endpoint,
                    latency_ms: start.elapsed().as_millis() as u64,
                    message: Some("Timeout (2s) ao contactar servidor Redis.".to_string()),
                    details: None,
                },
            }
        }
        None => ServiceHealth {
            name: "Redis Cache & Rate Limiting".to_string(),
            service_type: "CACHE".to_string(),
            status: "UNAVAILABLE".to_string(),
            endpoint: sanitized_endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some("Não foi possível estabelecer ligação com o Redis.".to_string()),
            details: None,
        },
    }
}

/// 2. Verificação do KudibaInvoicing (Motor Fiscal e Facturação)
async fn check_fiscal_engine(state: &AppState) -> ServiceHealth {
    let start = Instant::now();
    let health_url = format!(
        "{}/health",
        state.config.fiscal_engine_url.trim_end_matches('/')
    );

    match state
        .http_client
        .get(&health_url)
        .timeout(Duration::from_secs(2))
        .send()
        .await
    {
        Ok(res) if res.status().is_success() => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let details = res.json::<serde_json::Value>().await.ok();
            ServiceHealth {
                name: "Motor Fiscal (KudibaInvoicing)".to_string(),
                service_type: "FISCAL_ENGINE".to_string(),
                status: "HEALTHY".to_string(),
                endpoint: state.config.fiscal_engine_url.clone(),
                latency_ms,
                message: Some("Motor fiscal operacional em conformidade com o Decreto Presidencial n.º 71/25.".to_string()),
                details,
            }
        }
        Ok(res) => {
            let status_code = res.status();
            ServiceHealth {
                name: "Motor Fiscal (KudibaInvoicing)".to_string(),
                service_type: "FISCAL_ENGINE".to_string(),
                status: "DEGRADED".to_string(),
                endpoint: state.config.fiscal_engine_url.clone(),
                latency_ms: start.elapsed().as_millis() as u64,
                message: Some(format!(
                    "Motor fiscal respondeu com código anómalo HTTP {status_code}."
                )),
                details: None,
            }
        }
        Err(err) => ServiceHealth {
            name: "Motor Fiscal (KudibaInvoicing)".to_string(),
            service_type: "FISCAL_ENGINE".to_string(),
            status: "UNAVAILABLE".to_string(),
            endpoint: state.config.fiscal_engine_url.clone(),
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!("Inacessível: {err}")),
            details: None,
        },
    }
}

/// 3. Verificação do PostgreSQL (Base de Dados Relacional ACID)
async fn check_postgres(config: &Config) -> ServiceHealth {
    let start = Instant::now();
    let host = &config.postgres_host;
    let port = config.postgres_port;
    let endpoint = format!("{}:{}", host, port);

    match timeout(
        Duration::from_secs(2),
        TcpStream::connect((host.as_str(), port)),
    )
    .await
    {
        Ok(Ok(_stream)) => ServiceHealth {
            name: "PostgreSQL Database".to_string(),
            service_type: "DATABASE".to_string(),
            status: "HEALTHY".to_string(),
            endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!(
                "Socket TCP estabelecido com sucesso na porta {port}."
            )),
            details: None,
        },
        Ok(Err(err)) => ServiceHealth {
            name: "PostgreSQL Database".to_string(),
            service_type: "DATABASE".to_string(),
            status: "UNAVAILABLE".to_string(),
            endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!("Falha ao ligar ao PostgreSQL: {err}")),
            details: None,
        },
        Err(_) => ServiceHealth {
            name: "PostgreSQL Database".to_string(),
            service_type: "DATABASE".to_string(),
            status: "UNAVAILABLE".to_string(),
            endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some("Timeout (2s) ao tentar ligar ao PostgreSQL.".to_string()),
            details: None,
        },
    }
}

/// 4. Verificação do RabbitMQ (Message Broker & AMQP)
async fn check_rabbitmq(config: &Config) -> ServiceHealth {
    let start = Instant::now();
    let host = &config.rabbitmq_host;
    let port = config.rabbitmq_port;
    let endpoint = format!("{}:{}", host, port);

    match timeout(
        Duration::from_secs(2),
        TcpStream::connect((host.as_str(), port)),
    )
    .await
    {
        Ok(Ok(_stream)) => ServiceHealth {
            name: "RabbitMQ Message Broker".to_string(),
            service_type: "MESSAGE_BROKER".to_string(),
            status: "HEALTHY".to_string(),
            endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!(
                "Socket TCP estabelecido com sucesso na porta AMQP {port}."
            )),
            details: None,
        },
        Ok(Err(err)) => ServiceHealth {
            name: "RabbitMQ Message Broker".to_string(),
            service_type: "MESSAGE_BROKER".to_string(),
            status: "UNAVAILABLE".to_string(),
            endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!("Falha ao ligar ao RabbitMQ: {err}")),
            details: None,
        },
        Err(_) => ServiceHealth {
            name: "RabbitMQ Message Broker".to_string(),
            service_type: "MESSAGE_BROKER".to_string(),
            status: "UNAVAILABLE".to_string(),
            endpoint,
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some("Timeout (2s) ao tentar ligar ao RabbitMQ.".to_string()),
            details: None,
        },
    }
}

/// 5. Verificação do Core API (Módulos Comerciais e Administrativos)
async fn check_core_api(state: &AppState) -> ServiceHealth {
    let start = Instant::now();
    let health_url = format!("{}/health", state.config.core_api_url.trim_end_matches('/'));

    match state
        .http_client
        .get(&health_url)
        .timeout(Duration::from_secs(2))
        .send()
        .await
    {
        Ok(res) if res.status().is_success() => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let details = res.json::<serde_json::Value>().await.ok();
            ServiceHealth {
                name: "Core API Server".to_string(),
                service_type: "CORE_API".to_string(),
                status: "HEALTHY".to_string(),
                endpoint: state.config.core_api_url.clone(),
                latency_ms,
                message: Some("Core API operacional.".to_string()),
                details,
            }
        }
        Ok(res) => ServiceHealth {
            name: "Core API Server".to_string(),
            service_type: "CORE_API".to_string(),
            status: "DEGRADED".to_string(),
            endpoint: state.config.core_api_url.clone(),
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!(
                "Core API respondeu com código HTTP {}.",
                res.status()
            )),
            details: None,
        },
        Err(err) => ServiceHealth {
            name: "Core API Server".to_string(),
            service_type: "CORE_API".to_string(),
            status: "DEGRADED".to_string(), // Marcado como DEGRADED por estar em desenvolvimento modular
            endpoint: state.config.core_api_url.clone(),
            latency_ms: start.elapsed().as_millis() as u64,
            message: Some(format!(
                "Módulo Core API em desenvolvimento ou offline ({err})."
            )),
            details: None,
        },
    }
}

/// 6. Estado do Canal Webservices da AGT, reportado pelo conector oficial
///
/// O gateway não contacta a AGT directamente: o heartbeat tributário é da
/// responsabilidade do Motor Fiscal, que é o único componente autorizado a
/// sair do perímetro para o canal governamental (Decreto n.º 71/25). Aqui
/// apenas reflectimos o estado que ele já mede.
async fn check_agt_webservices(state: &AppState) -> ServiceHealth {
    let start = Instant::now();
    let status_url = format!(
        "{}/api/v1/fiscal/agt/status",
        state.config.fiscal_engine_url.trim_end_matches('/')
    );
    let endpoint = state.config.agt_platform_url.clone();

    let unavailable = |message: &str| ServiceHealth {
        name: "AGT Webservices (Facturação Electrónica)".to_string(),
        service_type: "EXTERNAL_GOV".to_string(),
        status: "DEGRADED".to_string(),
        endpoint: endpoint.clone(),
        latency_ms: start.elapsed().as_millis() as u64,
        message: Some(message.to_string()),
        details: None,
    };

    let res = match state
        .http_client
        .get(&status_url)
        .timeout(Duration::from_secs(3))
        .send()
        .await
    {
        Ok(res) => res,
        Err(_) => {
            return unavailable(
                "Motor fiscal inacessível: estado do canal AGT desconhecido (Decreto 71/25).",
            )
        }
    };

    let Ok(body) = res.json::<serde_json::Value>().await else {
        return unavailable("Motor fiscal devolveu uma resposta inválida para o estado da AGT.");
    };

    let is_online = body
        .get("isOnline")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let latency_ms = body
        .get("latencyMs")
        .and_then(|v| v.as_u64())
        .unwrap_or_else(|| start.elapsed().as_millis() as u64);
    let message = body
        .get("message")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let details = body
        .get("contingencyActive")
        .map(|v| serde_json::json!({ "contingencyActive": v, "heartbeat": body.get("checkedAt") }));

    ServiceHealth {
        name: "AGT Webservices (Facturação Electrónica)".to_string(),
        service_type: "EXTERNAL_GOV".to_string(),
        status: if is_online { "HEALTHY" } else { "DEGRADED" }.to_string(),
        endpoint,
        latency_ms,
        message,
        details,
    }
}

/// Remove credenciais confidenciais da URL do Redis para exibição segura
fn sanitize_redis_url(raw: &str) -> String {
    if let Some((proto, rest)) = raw.split_once("://") {
        if let Some((_auth, host)) = rest.split_once('@') {
            return format!("{}://***@{}", proto, host);
        }
    }
    raw.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn service(service_type: &str, status: &str) -> ServiceHealth {
        ServiceHealth {
            name: service_type.to_string(),
            service_type: service_type.to_string(),
            status: status.to_string(),
            endpoint: "http://svc:8080".to_string(),
            latency_ms: 1,
            message: None,
            details: None,
        }
    }

    #[test]
    fn agregacao_sa_de_todos_os_servicos() {
        let services = vec![
            service("CACHE", "HEALTHY"),
            service("DATABASE", "HEALTHY"),
            service("FISCAL_ENGINE", "HEALTHY"),
        ];
        let (summary, status) = aggregate(&services);
        assert_eq!(status, "HEALTHY");
        assert_eq!(summary.total, 3);
        assert_eq!(summary.healthy, 3);
        assert_eq!(summary.unavailable, 0);
    }

    #[test]
    fn indisponibilidade_critica_degrada_para_unhealthy() {
        let services = vec![
            service("CACHE", "UNAVAILABLE"),
            service("DATABASE", "HEALTHY"),
            service("FISCAL_ENGINE", "HEALTHY"),
        ];
        let (_, status) = aggregate(&services);
        assert_eq!(status, "UNHEALTHY");
    }

    #[test]
    fn falha_de_servico_nao_critico_fica_degraded() {
        let services = vec![
            service("CACHE", "HEALTHY"),
            service("DATABASE", "HEALTHY"),
            service("FISCAL_ENGINE", "HEALTHY"),
            service("CORE_API", "DEGRADED"),
            service("EXTERNAL_GOV", "DEGRADED"),
            service("MESSAGE_BROKER", "UNAVAILABLE"),
        ];
        let (summary, status) = aggregate(&services);
        assert_eq!(status, "DEGRADED");
        assert_eq!(summary.total, 6);
        assert_eq!(summary.degraded, 2);
        assert_eq!(summary.unavailable, 1);
    }

    #[test]
    fn motor_fiscal_indisponivel_nao_passa_despercebido() {
        let services = vec![
            service("CACHE", "HEALTHY"),
            service("DATABASE", "HEALTHY"),
            service("FISCAL_ENGINE", "UNAVAILABLE"),
        ];
        let (_, status) = aggregate(&services);
        assert_eq!(status, "UNHEALTHY");
    }

    #[test]
    fn credenciais_do_redis_nao_vazam_para_o_relatorio() {
        assert_eq!(
            sanitize_redis_url("redis://:s3cr3t@redis-host:6379/0"),
            "redis://***@redis-host:6379/0"
        );
        assert_eq!(
            sanitize_redis_url("redis://redis-host:6379/0"),
            "redis://redis-host:6379/0"
        );
    }
}
