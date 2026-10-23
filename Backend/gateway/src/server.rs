use axum::{
    body::Body,
    extract::State,
    http::{header::CONTENT_TYPE, StatusCode},
    middleware as axum_mw,
    response::{Html, IntoResponse, Json, Redirect, Response},
    routing::{any, get},
    Router,
};
use chrono::Utc;
use reqwest::Client;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;

use crate::config::Config;
use crate::errors::ProblemDetail;
use crate::middleware::{
    access_log::access_log_middleware, auth::auth_middleware,
    contingency::agt_contingency_middleware, correlation::correlation_id_middleware,
    idempotency::idempotency_middleware, ratelimit::rate_limit_middleware,
    tenant::tenant_resolver_middleware,
};
use crate::proxy::{
    forward_to_accounting, forward_to_auth, forward_to_auth_openapi, forward_to_backoffice,
    forward_to_core, forward_to_fiscal, forward_to_integrations, forward_to_inventory,
    forward_to_payroll, forward_to_treasury,
};

/// Estado global compartilhado entre os handlers e middlewares do Gateway
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub redis_client: redis::Client,
    pub redis_conn: Option<redis::aio::ConnectionManager>,
    pub http_client: Client,
    pub start_time: Instant,
    /// Memoização do relatório consolidado de saúde (`/health/services`)
    pub health_cache: Arc<Mutex<Option<(Instant, crate::health::SystemHealthResponse)>>>,
}

impl AppState {
    pub async fn get_redis_conn(&self) -> Option<redis::aio::ConnectionManager> {
        if let Some(conn) = &self.redis_conn {
            Some(conn.clone())
        } else {
            // Tenta inicializar sob demanda caso tenha falhado no startup
            redis::aio::ConnectionManager::new(self.redis_client.clone())
                .await
                .ok()
        }
    }
}

/// Constrói a pipeline completa de middlewares e roteador Axum do Gateway
pub fn create_router(
    config: Config,
    redis_client: redis::Client,
    redis_conn: Option<redis::aio::ConnectionManager>,
) -> Router {
    // Pool de cliente HTTP para encaminhamento do Reverse Proxy
    let http_client = Client::builder()
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(200)
        .tcp_keepalive(Duration::from_secs(30))
        .timeout(config.read_timeout)
        .build()
        .expect("Falha ao criar o pool HTTP do cliente reqwest");

    let state = AppState {
        config: Arc::new(config),
        redis_client,
        redis_conn,
        http_client,
        start_time: Instant::now(),
        health_cache: Arc::new(Mutex::new(None)),
    };

    // =========================================================================
    // ROTAS DE INFRAESTRUTURA E OBSERVABILIDADE (PÚBLICAS)
    // =========================================================================
    let infra_routes = Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        .route("/metrics", get(metrics_handler));

    // =========================================================================
    // DIAGNÓSTICO CONSOLIDADO DO CLUSTER (AUTENTICADO)
    // =========================================================================
    // Requer JWT válido: o relatório expõe hostnames e portas internas
    // (postgres:5432, rabbitmq:5672, ...) e não pode ficar aberto no perímetro.
    let services_routes = Router::new()
        .route("/health/services", get(services_health_handler))
        .route("/status", get(services_health_handler))
        .layer(axum_mw::from_fn_with_state(state.clone(), auth_middleware))
        // Rate limit antes da autenticação para limitar floods não autenticados
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ));

    // =========================================================================
    // DOCUMENTAÇÃO INTERATIVA DA API (SWAGGER UI & OPENAPI 3.1)
    // =========================================================================
    let docs_routes = Router::new()
        .route("/swagger", get(swagger_handler))
        .route("/docs", get(swagger_handler))
        .route("/docs/", get(swagger_handler))
        .route("/docs/{*path}", get(swagger_handler))
        .route("/swagger-ui", get(swagger_handler))
        .route("/swagger-ui/", get(swagger_handler))
        .route("/swagger-ui/{*path}", get(swagger_handler))
        // Compatibilidade: a antiga Scalar API Reference redirecciona para o Swagger UI
        .route("/scalar", get(|| async { Redirect::permanent("/swagger") }))
        .route(
            "/scalar/",
            get(|| async { Redirect::permanent("/swagger") }),
        )
        .route(
            "/scalar/{*path}",
            get(|| async { Redirect::permanent("/swagger") }),
        )
        .route("/api-docs/openapi.yaml", get(openapi_yaml_handler))
        // Spec OpenAPI do KudibaAuth (documento isolado, via proxy)
        .route("/api-docs/auth-openapi.json", get(forward_to_auth_openapi))
        // Documento OpenAPI unificado (Gateway + KudibaAuth) consumido pelo Swagger UI
        .route("/api-docs/openapi.json", get(merged_openapi_handler));

    // =========================================================================
    // ROTAS DE AUTENTICAÇÃO E SESSÕES (PÚBLICAS / KUDIBA AUTH)
    // =========================================================================
    let auth_routes = Router::new()
        .route("/auth/{*path}", any(forward_to_auth))
        .route("/auth", any(forward_to_auth))
        .route("/api/v1/auth/{*path}", any(forward_to_auth))
        .route("/api/v1/auth", any(forward_to_auth))
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ))
        .layer(axum_mw::from_fn(tenant_resolver_middleware));

    // =========================================================================
    // ROTAS DE RECEÇÃO DE WEBHOOKS DE INTEGRAÇÃO (PÚBLICAS / INTEGRATION HUB)
    // =========================================================================
    // Sistemas externos (ex.: relógios de ponto) autenticam-se pelo segredo do
    // webhook, não por JWT; por isso ficam fora da camada de autenticação mas
    // continuam limitadas por rate limit para mitigar floods.
    let integration_webhook_routes = Router::new()
        .route(
            "/api/v1/integrations/webhooks/{*path}",
            any(forward_to_integrations),
        )
        .route(
            "/api/v1/integrations/webhooks",
            any(forward_to_integrations),
        )
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ));

    // =========================================================================
    // ROTAS PROTEGIDAS DO ENTRYPOINT (REVERSE PROXY)
    // =========================================================================
    let api_routes = Router::new()
        // Rotas Fiscais de Alta Criticidade e Facturação (KudibaInvoicing)
        .route("/api/v1/fiscal/{*path}", any(forward_to_fiscal))
        .route("/api/v1/fiscal", any(forward_to_fiscal))
        .route("/api/v1/invoices/{*path}", any(forward_to_fiscal))
        .route("/api/v1/invoices", any(forward_to_fiscal))
        // Rotas de Inventário e Gestão de Stock (KudibaInventory)
        .route("/api/v1/inventory/{*path}", any(forward_to_inventory))
        .route("/api/v1/inventory", any(forward_to_inventory))
        // Rotas de Tesouraria, Caixa e Liquidações (KudibaTreasury)
        .route("/api/v1/treasury/{*path}", any(forward_to_treasury))
        .route("/api/v1/treasury", any(forward_to_treasury))
        // Rotas de Contabilidade Geral, PGC e SAF-T Contabilidade (KudibaAccounting)
        .route("/api/v1/accounting/{*path}", any(forward_to_accounting))
        .route("/api/v1/accounting", any(forward_to_accounting))
        // Rotas de Recursos Humanos e Processamento Salarial (KudibaPayroll)
        .route("/api/v1/payroll/{*path}", any(forward_to_payroll))
        .route("/api/v1/payroll", any(forward_to_payroll))
        // Rotas de Configuração de Integrações (KudibaIntegrations / backoffice)
        .route("/api/v1/integrations/{*path}", any(forward_to_integrations))
        .route("/api/v1/integrations", any(forward_to_integrations))
        // Rotas de Backoffice B2B — Clientes & Licenças (KudibaBackoffice)
        .route("/api/v1/backoffice/{*path}", any(forward_to_backoffice))
        .route("/api/v1/backoffice", any(forward_to_backoffice))
        // Rotas de Sincronização POS (Edge Tauri) e Módulos Comerciais
        .route("/api/v1/{*path}", any(forward_to_core))
        .route("/api/v1", any(forward_to_core))
        // Encadeamento de Middlewares de Negócio e Segurança (executados em ordem)
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            idempotency_middleware,
        ))
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            agt_contingency_middleware,
        ))
        .layer(axum_mw::from_fn_with_state(state.clone(), auth_middleware))
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ))
        .layer(axum_mw::from_fn(tenant_resolver_middleware));

    // =========================================================================
    // CONFIGURAÇÃO DINÂMICA DE CORS
    // =========================================================================
    let cors_layer = if state.config.allowed_origins == "*" {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        let configured_origins: Vec<String> = serde_json::from_str(&state.config.allowed_origins)
            .unwrap_or_else(|_| {
                state
                    .config
                    .allowed_origins
                    .split(',')
                    .map(|origin| origin.trim().to_string())
                    .collect()
            });
        let origins: Vec<_> = configured_origins
            .iter()
            .filter_map(|origin| origin.parse().ok())
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods(Any)
            .allow_headers(Any)
            .allow_credentials(true)
    }
    .expose_headers([
        "X-Correlation-ID".parse().unwrap(),
        "X-RateLimit-Limit".parse().unwrap(),
        "X-RateLimit-Remaining".parse().unwrap(),
        "X-RateLimit-Reset".parse().unwrap(),
        "Idempotent-Replay".parse().unwrap(),
    ]);

    // =========================================================================
    // JUNÇÃO DAS ROTAS E CAMADAS PERIMÉTRICAS GLOBAIS
    // =========================================================================
    Router::new()
        .merge(infra_routes)
        .merge(services_routes)
        .merge(docs_routes)
        .merge(auth_routes)
        .merge(integration_webhook_routes)
        .merge(api_routes)
        .with_state(state.clone())
        // Camadas globais de rede e transporte
        .layer(axum_mw::from_fn(access_log_middleware))
        .layer(axum_mw::from_fn(correlation_id_middleware))
        .layer(TimeoutLayer::new(state.config.write_timeout))
        .layer(RequestBodyLimitLayer::new(state.config.max_body_bytes))
        .layer(cors_layer)
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "UP",
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn ready_handler(State(state): State<AppState>) -> (StatusCode, Json<serde_json::Value>) {
    let mut redis_ok = false;
    if let Some(mut conn) = state.get_redis_conn().await {
        redis_ok = redis::cmd("PING")
            .query_async::<String>(&mut conn)
            .await
            .is_ok();
    }

    if redis_ok {
        (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "READY",
                "redis": "CONNECTED",
            })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "status": "NOT_READY",
                "redis": "DISCONNECTED",
            })),
        )
    }
}

async fn metrics_handler() -> String {
    crate::metrics::render()
}

/// Handler consolidado de diagnóstico e saúde de todos os serviços do ecossistema Kudiba
async fn services_health_handler(
    State(state): State<AppState>,
) -> (StatusCode, Json<crate::health::SystemHealthResponse>) {
    let report = crate::health::cached_system_health(&state).await;
    let status_code = if report.status == "UNHEALTHY" {
        StatusCode::SERVICE_UNAVAILABLE
    } else {
        StatusCode::OK
    };
    (status_code, Json(report))
}

// =============================================================================
// SWAGGER UI & ESPECIFICAÇÃO OPENAPI 3.1
// =============================================================================
const OPENAPI_SPEC: &str = include_str!("../docs/API_GATEWAY_OPENAPI.yaml");

const SWAGGER_HTML: &str = r##"<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kudiba ERP — API Reference (Swagger UI)</title>
  <link rel="icon" type="image/svg+xml" href="https://swagger.io/favicon.png" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api-docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>"##;

async fn openapi_yaml_handler() -> Response {
    Response::builder()
        .header(CONTENT_TYPE, "application/yaml; charset=utf-8")
        .body(Body::from(OPENAPI_SPEC))
        .unwrap()
}

async fn swagger_handler() -> Html<&'static str> {
    Html(SWAGGER_HTML)
}

/// Obtém a especificação OpenAPI do KudibaAuth através do cluster interno.
async fn fetch_auth_openapi(state: &AppState) -> Option<serde_json::Value> {
    let url = format!(
        "{}/api-docs/openapi.json",
        state.config.auth_service_url.trim_end_matches('/')
    );
    match state.http_client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => resp.json::<serde_json::Value>().await.ok(),
        Ok(resp) => {
            tracing::warn!("OpenAPI do KudibaAuth devolveu o estado {}", resp.status());
            None
        }
        Err(err) => {
            tracing::warn!("Falha ao obter OpenAPI do KudibaAuth: {err}");
            None
        }
    }
}

/// Funde a especificação do KudibaAuth (overlay) na especificação base do Gateway.
fn merge_openapi(base: &mut serde_json::Value, overlay: serde_json::Value) {
    if let (Some(base_paths), Some(overlay_paths)) = (
        base.get_mut("paths").and_then(|v| v.as_object_mut()),
        overlay.get("paths").and_then(|v| v.as_object()),
    ) {
        for (path, item) in overlay_paths {
            match base_paths.get_mut(path).and_then(|v| v.as_object_mut()) {
                Some(existing) => {
                    if let Some(methods) = item.as_object() {
                        for (method, operation) in methods {
                            existing
                                .entry(method.clone())
                                .or_insert_with(|| operation.clone());
                        }
                    }
                }
                None => {
                    base_paths.insert(path.clone(), item.clone());
                }
            }
        }
    }

    if let (Some(base_components), Some(overlay_components)) = (
        base.get_mut("components").and_then(|v| v.as_object_mut()),
        overlay.get("components").and_then(|v| v.as_object()),
    ) {
        for (section, overlay_section) in overlay_components {
            match base_components.get_mut(section) {
                Some(existing) => {
                    if let (Some(existing_map), Some(overlay_map)) =
                        (existing.as_object_mut(), overlay_section.as_object())
                    {
                        for (key, value) in overlay_map {
                            existing_map
                                .entry(key.clone())
                                .or_insert_with(|| value.clone());
                        }
                    }
                }
                None => {
                    base_components.insert(section.clone(), overlay_section.clone());
                }
            }
        }
    }
}

/// Documento OpenAPI unificado (Gateway + KudibaAuth) consumido pelo Swagger UI.
async fn merged_openapi_handler(State(state): State<AppState>) -> Response {
    let mut document: serde_json::Value = match serde_yaml::from_str(OPENAPI_SPEC) {
        Ok(value) => value,
        Err(err) => {
            tracing::error!("Falha ao interpretar a especificação OpenAPI base: {err}");
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/openapi-unavailable",
                "Especificação OpenAPI Indisponível",
                StatusCode::INTERNAL_SERVER_ERROR,
                "Não foi possível interpretar o manifesto OpenAPI base do Gateway.",
                "/api-docs/openapi.json",
                "OPENAPI_PARSE_ERROR",
            )
            .into_response();
        }
    };

    match fetch_auth_openapi(&state).await {
        Some(auth_spec) => merge_openapi(&mut document, auth_spec),
        None => tracing::warn!(
            "Especificação do KudibaAuth indisponível: a documentação é servida apenas com o Gateway."
        ),
    }

    Response::builder()
        .header(CONTENT_TYPE, "application/json; charset=utf-8")
        .body(Body::from(document.to_string()))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}
