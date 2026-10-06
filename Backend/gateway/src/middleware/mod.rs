pub mod correlation;
pub mod tenant;
pub mod ratelimit;
pub mod auth;
pub mod contingency;
pub mod idempotency;

/// Centraliza a definição de rotas públicas isentas de autenticação e tenant
pub fn is_public_path(path: &str) -> bool {
    let clean = path.trim_end_matches('/');
    if clean.is_empty() {
        return false;
    }

    // Healthchecks e Métricas
    if clean == "/health" || clean == "/ready" || clean == "/metrics" {
        return true;
    }

    // Documentação Interativa
    if clean == "/scalar" || clean.starts_with("/scalar/")
        || clean == "/docs" || clean.starts_with("/docs/")
        || clean == "/swagger-ui" || clean.starts_with("/swagger-ui/")
        || clean == "/swagger"
        || clean == "/api-docs/openapi.yaml"
    {
        return true;
    }

    // Autenticação Pública e JWKS
    if clean == "/auth/login" || clean == "/auth/refresh" || clean == "/auth/.well-known/jwks.json"
        || clean == "/api/v1/auth/login" || clean == "/api/v1/auth/refresh" || clean == "/api/v1/auth/.well-known/jwks.json"
    {
        return true;
    }

    false
}
