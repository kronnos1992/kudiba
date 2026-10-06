pub mod auth;
pub mod contingency;
pub mod correlation;
pub mod idempotency;
pub mod ratelimit;
pub mod tenant;

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
    use super::is_public_path;

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
