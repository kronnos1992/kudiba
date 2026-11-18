use axum::{
    body::Body,
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use http_body_util::BodyExt;
use redis::AsyncCommands;
use serde_json::Value;

use crate::errors::ProblemDetail;
use crate::server::AppState;

fn is_sync_probe_path(method: &Method, path: &str) -> bool {
    method == Method::POST && path == "/api/v1/fiscal/agt/sync"
}

fn is_fiscal_issuance_path(method: &Method, path: &str) -> bool {
    method == Method::POST
        && !is_sync_probe_path(method, path)
        && (path.starts_with("/api/v1/invoices")
            || path.starts_with("/api/v1/fiscal")
            || path.starts_with("/fiscal/invoices"))
}

fn resolved_tenant_id(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("X-Resolved-Tenant-ID")
        .and_then(|header| header.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn issuance_allowed_by_state(last_sync_state: Result<Option<String>, ()>, max_days: i64) -> bool {
    match last_sync_state {
        Err(()) => false,
        Ok(None) => true,
        Ok(Some(raw)) => match DateTime::parse_from_rfc3339(&raw) {
            Ok(last_sync) => {
                Utc::now()
                    .signed_duration_since(last_sync.with_timezone(&Utc))
                    .num_days()
                    <= max_days
            }
            Err(_) => false,
        },
    }
}

fn payload_sections(value: &Value) -> impl Iterator<Item = &Value> {
    std::iter::once(value)
        .chain(value.get("data"))
        .chain(value.get("result"))
}

fn has_protocol_number(value: &Value) -> bool {
    payload_sections(value).any(|section| {
        ["protocolNumber", "protocol_number"].iter().any(|name| {
            section
                .get(*name)
                .and_then(Value::as_str)
                .is_some_and(|raw| !raw.trim().is_empty())
        })
    })
}

fn numeric_field(value: &Value, names: &[&str]) -> i64 {
    payload_sections(value)
        .flat_map(|section| names.iter().filter_map(|name| section.get(*name)))
        .find_map(|raw| {
            raw.as_i64()
                .or_else(|| raw.as_u64().and_then(|value| i64::try_from(value).ok()))
                .or_else(|| raw.as_str().and_then(|value| value.parse().ok()))
        })
        .unwrap_or(0)
}

fn sync_response_proves_agt_communication(body: &[u8]) -> bool {
    let Ok(value) = serde_json::from_slice::<Value>(body) else {
        return false;
    };
    let accepted = numeric_field(&value, &["acceptedCount", "accepted_count"]);
    let rejected = numeric_field(&value, &["rejectedCount", "rejected_count"]);
    has_protocol_number(&value) || (accepted > 0 && rejected == 0)
}

fn locked_response(path: &str, max_days: i64, state_unavailable: bool) -> Response {
    let (title, detail, code) = if state_unavailable {
        (
            "Estado de Contingência Indisponível".to_string(),
            "Não foi possível verificar o estado de comunicação com a Plataforma Electrónica. A emissão fiscal está temporariamente bloqueada.".to_string(),
            "AGT_CONTINGENCY_STATE_UNAVAILABLE".to_string(),
        )
    } else {
        (
            "Limite Legal de Contingência Excedido (Bloqueio Fiscal)".to_string(),
            format!(
                "Emissão fiscal suspensa. O sistema excedeu o limite máximo legal de {} dias sem comunicação com a Plataforma Electrónica (Decreto Presidencial n.º 71/25 de Angola). Restabeleça a ligação para desbloquear.",
                max_days
            ),
            "AGT_CONTINGENCY_LIMIT_EXCEEDED".to_string(),
        )
    };
    ProblemDetail::new(
        "https://api.kudiba.ao/errors/agt-communication-timeout",
        title,
        StatusCode::LOCKED,
        detail,
        path,
        code,
    )
    .into_response()
}

/// Guarda regulatória AGT (Decreto Presidencial n.º 71/25).
/// Bloqueia emissão fiscal após o limite legal sem sincronização e regista
/// a última sincronização bem-sucedida devolvida pelo motor fiscal.
pub async fn agt_contingency_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    let tenant_id = resolved_tenant_id(req.headers());
    let is_successful_sync_probe = is_sync_probe_path(req.method(), &path);
    let is_fiscal_issuance = is_fiscal_issuance_path(req.method(), &path);

    if is_fiscal_issuance {
        let cache_key = tenant_id
            .as_deref()
            .map(|tenant| format!("fiscal:contingency:{tenant}:last_successful_sync"));
        let last_sync_state = match cache_key {
            None => Err(()),
            Some(cache_key) => match state.get_redis_conn().await {
                None => Err(()),
                Some(mut redis_conn) => match redis_conn.get(&cache_key).await {
                    Ok(raw) => Ok(raw),
                    Err(error) => {
                        tracing::warn!(tenant_id = %tenant_id.as_deref().unwrap_or(""), error = %error, "falha ao ler estado de contingência AGT");
                        Err(())
                    }
                },
            },
        };
        let state_unavailable = last_sync_state.is_err();
        if !issuance_allowed_by_state(last_sync_state, state.config.agt_contingency_max_days) {
            return locked_response(
                &path,
                state.config.agt_contingency_max_days,
                state_unavailable,
            );
        }
    }

    let response = next.run(req).await;

    if !is_successful_sync_probe || !response.status().is_success() {
        return response;
    }

    let (parts, body) = response.into_parts();
    let collected = match body.collect().await {
        Ok(collected) => collected,
        Err(_) => {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/bad-gateway",
                "Falha ao Receber Resposta do Upstream",
                StatusCode::BAD_GATEWAY,
                "O serviço interno retornou erro ao enviar o fluxo de dados.",
                path.as_str(),
                "UPSTREAM_STREAM_ERROR",
            )
            .into_response();
        }
    };
    let bytes = collected.to_bytes();
    let should_refresh = sync_response_proves_agt_communication(&bytes);
    let response = Response::from_parts(parts, Body::from(bytes));

    if should_refresh {
        if let (Some(tenant_id), Some(mut redis_conn)) = (tenant_id, state.get_redis_conn().await) {
            let cache_key = format!("fiscal:contingency:{tenant_id}:last_successful_sync");
            if let Err(error) = redis_conn
                .set::<_, _, ()>(&cache_key, Utc::now().to_rfc3339())
                .await
            {
                tracing::warn!(tenant_id = %tenant_id, error = %error, "falha ao registar última sincronização AGT");
            }
        }
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    #[test]
    fn agt_sync_is_not_blocked_by_the_fiscal_issuance_guard() {
        assert!(is_sync_probe_path(&Method::POST, "/api/v1/fiscal/agt/sync"));
        assert!(!is_sync_probe_path(
            &Method::POST,
            "/api/v1/fiscal/agt/sync/other"
        ));
        assert!(!is_sync_probe_path(&Method::GET, "/api/v1/fiscal/agt/sync"));
        assert!(!is_fiscal_issuance_path(
            &Method::POST,
            "/api/v1/fiscal/agt/sync"
        ));
        assert!(is_fiscal_issuance_path(&Method::POST, "/api/v1/invoices"));
        assert!(!is_fiscal_issuance_path(&Method::GET, "/api/v1/invoices"));
    }

    #[test]
    fn tenant_comes_only_from_the_canonical_header() {
        let mut headers = HeaderMap::new();
        headers.insert("X-Tenant-ID", "forged-tenant".parse().unwrap());
        assert!(resolved_tenant_id(&headers).is_none());

        headers.insert("X-Resolved-Tenant-ID", "canonical-tenant".parse().unwrap());
        assert_eq!(
            resolved_tenant_id(&headers).as_deref(),
            Some("canonical-tenant")
        );
    }

    #[test]
    fn unreadable_redis_state_fails_closed() {
        assert!(!issuance_allowed_by_state(Err(()), 60));
        assert!(issuance_allowed_by_state(Ok(None), 60));
        assert!(!issuance_allowed_by_state(
            Ok(Some("not-a-timestamp".to_string())),
            60
        ));
        let stale = (Utc::now() - chrono::Duration::days(61)).to_rfc3339();
        assert!(!issuance_allowed_by_state(Ok(Some(stale)), 60));
        let fresh = Utc::now().to_rfc3339();
        assert!(issuance_allowed_by_state(Ok(Some(fresh)), 60));
    }

    #[test]
    fn empty_sync_batch_does_not_prove_agt_communication() {
        assert!(!sync_response_proves_agt_communication(
            br#"{"totalDocuments":0,"acceptedCount":0,"rejectedCount":0}"#
        ));
        assert!(!sync_response_proves_agt_communication(
            br#"{"totalDocuments":2,"acceptedCount":0,"rejectedCount":2}"#
        ));
        assert!(!sync_response_proves_agt_communication(b"not json"));
    }

    #[test]
    fn real_agt_communication_refreshes_the_sync_state() {
        assert!(sync_response_proves_agt_communication(
            br#"{"protocolNumber":"AGT-2026-001","acceptedCount":0,"rejectedCount":0}"#
        ));
        assert!(sync_response_proves_agt_communication(
            br#"{"acceptedCount":3,"rejectedCount":0}"#
        ));
        assert!(!sync_response_proves_agt_communication(
            br#"{"acceptedCount":3,"rejectedCount":1}"#
        ));
        assert!(sync_response_proves_agt_communication(
            br#"{"data":{"protocol_number":"AGT-2"}}"#
        ));
    }
}
