use axum::{extract::Request, http::HeaderMap, middleware::Next, response::Response};

pub mod access_log;
pub mod auth;
pub mod contingency;
pub mod correlation;
pub mod idempotency;
pub mod ratelimit;
pub mod tenant;

/// Headers que só podem ser definidos pelo gateway ou pelo próprio serviço.
/// O cliente nunca os controla, directamente ou por duplicação de valores.
pub fn is_gateway_owned_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "x-resolved-tenant-id"
            | "x-resolved-tenant-slug"
            | "x-resolved-user-id"
            | "x-resolved-user-name"
            | "x-resolved-email"
            | "x-resolved-user-email"
            | "x-resolved-roles"
            | "x-resolved-branch-id"
            | "x-user-id"
            | "x-user-name"
            | "x-gateway-timestamp"
            | "x-gateway-signature"
    )
}

/// Remove, na entrada, qualquer cópia fornecida pelo cliente de headers
/// pertencentes ao gateway. Os middlewares internos voltam a injectar os
/// valores autenticados antes do encaminhamento para os microsserviços.
pub fn sanitize_gateway_headers(headers: &mut HeaderMap) {
    let owned: Vec<_> = headers
        .keys()
        .filter(|name| is_gateway_owned_header(name.as_str()))
        .cloned()
        .collect();
    for name in owned {
        headers.remove(name);
    }
}

pub async fn sanitize_middleware(mut req: Request, next: Next) -> Response {
    sanitize_gateway_headers(req.headers_mut());
    next.run(req).await
}

pub fn is_auth_service_path(path: &str) -> bool {
    let clean = path.trim_end_matches('/');
    clean == "/auth"
        || clean.starts_with("/auth/")
        || clean == "/api/v1/auth"
        || clean.starts_with("/api/v1/auth/")
}

/// Centraliza a definição de rotas públicas isentas de autenticação e tenant
pub fn is_public_path(path: &str) -> bool {
    let clean = path.trim_end_matches('/');
    if clean.is_empty() {
        return false;
    }

    // Healthchecks e Métricas de sondagem externa (não expõem estado interno).
    // `/health/services` e `/status` ficam deliberadamente de fora: exigem JWT
    // (ver `services_routes` em server.rs) porque revelam hostnames e portas internas.
    if clean == "/health" || clean == "/ready" || clean == "/metrics" {
        return true;
    }

    // Documentação Interativa
    if clean == "/scalar"
        || clean.starts_with("/scalar/")
        || clean == "/docs"
        || clean.starts_with("/docs/")
        || clean == "/swagger-ui"
        || clean.starts_with("/swagger-ui/")
        || clean == "/swagger"
        || clean == "/api-docs/openapi.yaml"
    {
        return true;
    }

    // Autenticação Pública e JWKS
    if clean == "/auth/login"
        || clean == "/auth/refresh"
        || clean == "/auth/.well-known/jwks.json"
        || clean == "/api/v1/auth/login"
        || clean == "/api/v1/auth/refresh"
        || clean == "/api/v1/auth/.well-known/jwks.json"
    {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::{
        is_auth_service_path, is_gateway_owned_header, is_public_path, sanitize_gateway_headers,
    };
    use axum::http::HeaderMap;

    #[test]
    fn ingress_sanitization_removes_all_client_supplied_gateway_headers() {
        let mut headers = HeaderMap::new();
        for name in [
            "X-Resolved-Tenant-ID",
            "x-resolved-roles",
            "X-User-ID",
            "X-Gateway-Signature",
            "x-gateway-timestamp",
        ] {
            headers.insert(name, "forged".parse().unwrap());
        }
        headers.insert("authorization", "Bearer token".parse().unwrap());

        sanitize_gateway_headers(&mut headers);

        assert!(headers
            .keys()
            .all(|name| !is_gateway_owned_header(name.as_str())));
        assert_eq!(headers.get("authorization").unwrap(), "Bearer token");
    }

    #[test]
    fn auth_service_paths_are_routed_without_tenant_resolution() {
        for path in [
            "/auth/me",
            "/auth/logout",
            "/api/v1/auth/users",
            "/api/v1/auth/switch-tenant",
        ] {
            assert!(
                is_auth_service_path(path),
                "{path} deve ser encaminhada ao Auth"
            );
        }
        assert!(!is_auth_service_path("/api/v1/invoices"));
    }

    #[test]
    fn sondas_de_liveness_continuam_publicas() {
        for path in ["/health", "/ready", "/metrics"] {
            assert!(is_public_path(path), "{path} deve ser pública");
        }
    }

    #[test]
    fn diagnostico_consolidado_exige_autenticacao() {
        for path in ["/health/services", "/status"] {
            assert!(
                !is_public_path(path),
                "{path} expõe topologia interna e não pode ser pública"
            );
        }
    }
}
