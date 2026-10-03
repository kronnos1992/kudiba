use axum::{
    extract::Request,
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use uuid::Uuid;

use crate::errors::ProblemDetail;

/// Middleware de higienização contra Header Spoofing e resolução Multi-Tenant
pub async fn tenant_resolver_middleware(mut req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();

    // 1. Sanitizar a requisição: remover headers internos forjados externamente
    req.headers_mut().remove("X-Resolved-Tenant-ID");
    req.headers_mut().remove("X-Resolved-User-ID");
    req.headers_mut().remove("X-Resolved-Roles");

    // 2. Rotas públicas não exigem identificação de tenant
    if is_public_path(&path) {
        return next.run(req).await;
    }

    let mut resolved_tenant = None;

    // Estratégia A: Subdomínio (ex: empresa1.kudiba.ao)
    if let Some(host) = req.headers().get("host").and_then(|h| h.to_str().ok()) {
        let clean_host = host.split(':').next().unwrap_or(host);
        let parts: Vec<&str> = clean_host.split('.').collect();
        if parts.len() >= 3 && parts[0] != "api" && parts[0] != "app" && parts[0] != "staging-api" {
            resolved_tenant = Some(parts[0].to_string());
        }
    }

    // Estratégia B: Cabeçalho X-Tenant-ID (usado por POS Desktop e APIs)
    if resolved_tenant.is_none() {
        if let Some(header_tenant) = req.headers().get("X-Tenant-ID").and_then(|h| h.to_str().ok()) {
            if Uuid::parse_str(header_tenant).is_ok() {
                resolved_tenant = Some(header_tenant.to_string());
            }
        }
    }

    // Se a rota exige tenant e nenhuma identificação válida foi fornecida
    match resolved_tenant {
        Some(tenant_id) => {
            if let Ok(header_val) = HeaderValue::from_str(&tenant_id) {
                req.headers_mut().insert("X-Resolved-Tenant-ID", header_val);
            }
            next.run(req).await
        }
        None => {
            ProblemDetail::new(
                "https://api.kudiba.ao/errors/tenant-resolution-failed",
                "Identificação de Organização Ausente",
                StatusCode::BAD_REQUEST,
                "Não foi possível identificar o tenant. Forneça o cabeçalho X-Tenant-ID ou acesse através do subdomínio da organização.",
                path,
                "TENANT_IDENTIFICATION_REQUIRED",
            ).into_response()
        }
    }
}

fn is_public_path(path: &str) -> bool {
    let public_paths = [
        "/health",
        "/ready",
        "/metrics",
        "/auth/login",
        "/auth/refresh",
        "/auth/.well-known/jwks.json",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/.well-known/jwks.json",
    ];
    public_paths.contains(&path)
}
