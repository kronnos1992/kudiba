use axum::{
    extract::Request,
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use uuid::Uuid;

use crate::errors::ProblemDetail;
use crate::middleware::{is_auth_service_path, is_public_path};

/// Middleware de higienização contra Header Spoofing e resolução Multi-Tenant
pub async fn tenant_resolver_middleware(mut req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();

    // 1. Sanitizar a requisição: remover headers internos forjados externamente
    req.headers_mut().remove("X-Resolved-Tenant-ID");
    req.headers_mut().remove("X-Resolved-Tenant-Slug");
    req.headers_mut().remove("X-Resolved-User-ID");
    req.headers_mut().remove("X-Resolved-Roles");
    req.headers_mut().remove("X-Resolved-Branch-ID");

    // 2. Rotas públicas não exigem identificação prévia de tenant
    if is_public_path(&path) {
        return next.run(req).await;
    }

    // The Auth service derives tenant context from the verified access token.
    // Requiring a separate tenant header here would block authenticated auth routes.
    if is_auth_service_path(&path) {
        return next.run(req).await;
    }

    let mut resolved_tenant = None;
    let mut resolved_slug = None;

    // Estratégia A: Subdomínio (ex: empresa1.kudiba.ao)
    if let Some(host) = req.headers().get("host").and_then(|h| h.to_str().ok()) {
        let clean_host = host.split(':').next().unwrap_or(host);
        let parts: Vec<&str> = clean_host.split('.').collect();
        if parts.len() >= 3
            && parts[0] != "api"
            && parts[0] != "app"
            && parts[0] != "staging-api"
            && parts[0] != "www"
            && parts[0] != "localhost"
        {
            let slug = parts[0].to_string();
            resolved_slug = Some(slug.clone());
            resolved_tenant = Some(slug);
        }
    }

    // Estratégia B: Cabeçalho X-Tenant-ID (usado por POS Desktop e integrações B2B)
    if let Some(header_tenant) = req.headers().get("X-Tenant-ID").and_then(|h| h.to_str().ok()) {
        let trimmed = header_tenant.trim();
        // Aceita UUID ou identificador alfanumérico seguro
        if Uuid::parse_str(trimmed).is_ok() || trimmed.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            resolved_tenant = Some(trimmed.to_string());
        }
    }

    // Se a rota exige tenant e nenhuma identificação válida foi fornecida
    match resolved_tenant {
        Some(tenant_id) => {
            if let Ok(header_val) = HeaderValue::from_str(&tenant_id) {
                req.headers_mut().insert("X-Resolved-Tenant-ID", header_val);
            }
            if let Some(slug) = resolved_slug {
                if let Ok(slug_val) = HeaderValue::from_str(&slug) {
                    req.headers_mut().insert("X-Resolved-Tenant-Slug", slug_val);
                }
            }
            next.run(req).await
        }
        None => {
            ProblemDetail::new(
                "https://api.kudiba.ao/errors/tenant-resolution-failed",
                "Identificação de Organização Ausente",
                StatusCode::BAD_REQUEST,
                "Não foi possível identificar a organização. Forneça o cabeçalho X-Tenant-ID ou acesse através do subdomínio da empresa.",
                path,
                "TENANT_IDENTIFICATION_REQUIRED",
            ).into_response()
        }
    }
}
