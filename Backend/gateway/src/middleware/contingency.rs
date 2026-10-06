use axum::{
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use redis::AsyncCommands;

use crate::errors::ProblemDetail;
use crate::server::AppState;

/// Middleware de Guarda Regulatória AGT (Decreto Presidencial n.º 71/25)
/// Bloqueia a emissão com HTTP 423 Locked se a organização estiver há mais de 60 dias sem comunicação
pub async fn agt_contingency_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();

    // Aplica-se à emissão de novos documentos fiscais (FT, FR, NC, ND)
    let is_fiscal_issuance = req.method() == Method::POST
        && (path.starts_with("/api/v1/invoices")
            || path.starts_with("/api/v1/fiscal")
            || path.starts_with("/fiscal/invoices"));

    if is_fiscal_issuance {
        let tenant_id = req
            .headers()
            .get("X-Resolved-Tenant-ID")
            .or_else(|| req.headers().get("X-Tenant-ID"))
            .and_then(|h| h.to_str().ok());

        if let Some(t_id) = tenant_id {
            if let Some(mut redis_conn) = state.get_redis_conn().await {
                let cache_key = format!("fiscal:contingency:{}:last_successful_sync", t_id);
                let last_sync_raw: Option<String> = redis_conn.get(&cache_key).await.ok();

                if let Some(timestamp_str) = last_sync_raw {
                    if let Ok(last_sync) = DateTime::parse_from_rfc3339(&timestamp_str) {
                        let duration = Utc::now().signed_duration_since(last_sync.with_timezone(&Utc));
                        let days_offline = duration.num_days();

                        if days_offline > state.config.agt_contingency_max_days {
                            return ProblemDetail::new(
                                "https://api.kudiba.ao/errors/agt-communication-timeout",
                                "Limite Legal de Contingência Excedido (Bloqueio AGT)",
                                StatusCode::LOCKED, // 423 Locked
                                format!(
                                    "Emissão fiscal suspensa. O sistema excedeu o limite máximo legal de {} dias sem comunicação com a Plataforma Electrónica da AGT (Decreto Presidencial n.º 71/25 de Angola). Restabeleça a ligação para desbloquear.",
                                    state.config.agt_contingency_max_days
                                ),
                                path,
                                "AGT_CONTINGENCY_LIMIT_EXCEEDED",
                            ).into_response();
                        }
                    }
                } else {
                    tracing::debug!(tenant_id = %t_id, "Tenant sem timestamp prévio de sincronização AGT em cache.");
                }
            }
        }
    }

    next.run(req).await
}
