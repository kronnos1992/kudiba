use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
};
use serde::Deserialize;
use serde_json::Value;
use std::time::Duration;

use crate::errors::ProblemDetail;
use crate::proxy::compute_gateway_signature;
use crate::server::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemAuditQueryParams {
    pub tenant_id: Option<uuid::Uuid>,
    pub module: Option<String>,
    pub action: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct AuditPage {
    #[serde(default)]
    items: Vec<Value>,
    #[serde(default)]
    total: i64,
}

pub async fn aggregate_system_audit_trail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<SystemAuditQueryParams>,
) -> Response {
    let instance_path = "/api/v1/fiscal/system-audit-trail";

    let tenant_id = match headers
        .get("X-Resolved-Tenant-ID")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| uuid::Uuid::parse_str(value.trim()).ok())
    {
        Some(id) => id,
        None => {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/tenant-resolution-failed",
                "Identificação de Organização Ausente",
                StatusCode::UNAUTHORIZED,
                "Não foi possível identificar a organização para consultar a trilha de auditoria.",
                instance_path,
                "TENANT_IDENTIFICATION_REQUIRED",
            )
            .into_response();
        }
    };

    if let Some(requested) = params.tenant_id {
        if requested != tenant_id {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/forbidden",
                "Empresa Não Autorizada",
                StatusCode::FORBIDDEN,
                "A empresa solicitada não corresponde à empresa autenticada.",
                instance_path,
                "TENANT_MISMATCH",
            )
            .into_response();
        }
    }

    if !is_audit_viewer(&headers) {
        return ProblemDetail::new(
            "https://api.kudiba.ao/errors/audit-access-denied",
            "Acesso Negado",
            StatusCode::FORBIDDEN,
            "Apenas perfis de administração, auditoria ou gestão podem consultar a trilha de auditoria.",
            instance_path,
            "AUDIT_ACCESS_DENIED",
        )
        .into_response();
    }

    let limit = params.limit.unwrap_or(150).clamp(1, 500);
    let offset = params.offset.unwrap_or(0).max(0);
    let upstream_limit = (limit + offset).min(500);

    let mut query: Vec<(&str, String)> = vec![
        ("limit", upstream_limit.to_string()),
        ("offset", "0".to_string()),
    ];
    push_filter(&mut query, "module", params.module.as_deref());
    push_filter(&mut query, "action", params.action.as_deref());
    push_filter(&mut query, "search", params.search.as_deref());

    let forwarded_headers = forwarded_identity_headers(&headers);

    let (invoicing, treasury, accounting, inventory, auth, payroll, integrations, backoffice) = tokio::join!(
        fetch_page(
            &state,
            &state.config.fiscal_engine_url,
            "/api/v1/fiscal/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.treasury_service_url,
            "/api/v1/treasury/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.accounting_service_url,
            "/api/v1/accounting/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.inventory_service_url,
            "/api/v1/inventory/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.auth_service_url,
            "/api/v1/auth/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.payroll_service_url,
            "/api/v1/payroll/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.integrations_service_url,
            "/api/v1/integrations/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
        fetch_page(
            &state,
            &state.config.backoffice_service_url,
            "/api/v1/backoffice/system-audit-trail",
            &query,
            &forwarded_headers,
        ),
    );

    let mut items = Vec::new();
    let mut total = 0i64;
    let mut available = false;

    for page in [
        invoicing,
        treasury,
        accounting,
        inventory,
        auth,
        payroll,
        integrations,
        backoffice,
    ]
    .into_iter()
    .flatten()
    {
        available = true;
        total += page.total;
        items.extend(page.items);
    }

    if !available {
        return ProblemDetail::new(
            "https://api.kudiba.ao/errors/bad-gateway",
            "Trilha de Auditoria Indisponível",
            StatusCode::BAD_GATEWAY,
            "Não foi possível obter registos de auditoria dos serviços internos.",
            instance_path,
            "AUDIT_UPSTREAM_UNAVAILABLE",
        )
        .into_response();
    }

    items.sort_by_key(|item| std::cmp::Reverse(created_at_micros(item)));

    let items: Vec<Value> = items
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .collect();

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "items": items,
            "total": total
        })),
    )
        .into_response()
}

fn is_audit_viewer(headers: &HeaderMap) -> bool {
    headers
        .get("X-Resolved-Roles")
        .and_then(|value| value.to_str().ok())
        .map(|raw| {
            raw.split(',')
                .map(|role| role.trim().to_uppercase())
                .any(|role| {
                    matches!(
                        role.as_str(),
                        "ADMIN"
                            | "ADMINISTRADOR"
                            | "SYSADMIN"
                            | "SUPER_ADMIN"
                            | "AUDITOR"
                            | "GESTOR"
                            | "CONTABILISTA"
                    )
                })
        })
        .unwrap_or(false)
}

fn push_filter(query: &mut Vec<(&'static str, String)>, key: &'static str, value: Option<&str>) {
    if let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) {
        query.push((key, value.to_string()));
    }
}

fn forwarded_identity_headers(headers: &HeaderMap) -> Vec<(String, String)> {
    [
        "X-Resolved-Tenant-ID",
        "X-Resolved-User-ID",
        "X-Resolved-Roles",
        "X-Resolved-Branch-ID",
        "X-Tenant-ID",
        "X-Correlation-ID",
        "traceparent",
    ]
    .iter()
    .filter_map(|name| {
        headers
            .get(*name)
            .and_then(|value| value.to_str().ok())
            .map(|value| ((*name).to_string(), value.to_string()))
    })
    .collect()
}

fn created_at_micros(value: &Value) -> i64 {
    value
        .get("created_at")
        .and_then(Value::as_str)
        .and_then(|raw| chrono::DateTime::parse_from_rfc3339(raw).ok())
        .map(|timestamp| timestamp.timestamp_micros())
        .unwrap_or(0)
}

async fn fetch_page(
    state: &AppState,
    base_url: &str,
    path: &str,
    query: &[(&str, String)],
    forwarded_headers: &[(String, String)],
) -> Option<AuditPage> {
    let url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let canonical = format!("{}:GET:{}", timestamp, path);
    let signature =
        compute_gateway_signature(state.config.internal_gateway_secret.as_bytes(), &canonical);

    let mut request = state
        .http_client
        .get(&url)
        .query(query)
        .timeout(Duration::from_secs(5))
        .header("X-Gateway-Timestamp", timestamp)
        .header("X-Gateway-Signature", signature);

    for (name, value) in forwarded_headers {
        request = request.header(name.as_str(), value.as_str());
    }

    match request.send().await {
        Ok(response) if response.status().is_success() => {
            match response.json::<AuditPage>().await {
                Ok(page) => Some(page),
                Err(err) => {
                    tracing::warn!("Resposta de auditoria inválida de {}: {err}", url);
                    None
                }
            }
        }
        Ok(response) => {
            tracing::warn!(
                "Serviço de auditoria {} devolveu o estado {}",
                url,
                response.status()
            );
            None
        }
        Err(err) => {
            tracing::warn!("Falha ao contactar o serviço de auditoria {}: {err}", url);
            None
        }
    }
}
