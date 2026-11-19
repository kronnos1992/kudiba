use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use kudiba_gateway_signature::{canonical_json_bytes, compute_payload_signature};
use ring::rand::{SecureRandom, SystemRandom};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::pos_hardware::domain::{
    BootstrapRequest, BootstrapResponse, CreateTerminalRequest, PairingStatusResponse,
    PairingTokenLookup, PairingTokenResponse, PosHardwareError, PosTerminalListResponse,
    PosTerminalResponse, RevokeTerminalResponse, SeedItem, SeedPayload, SeedResponse,
    TerminalStatus,
};
use crate::pos_hardware::ports::PosHardwareRepository;

const PAIRING_TOKEN_TTL_SECONDS: i64 = 300;
const MAX_PAIRING_ATTEMPTS: i16 = 5;
const SEED_TTL_HOURS: i64 = 24;

pub struct PosHardwareHandler {
    repository: Arc<dyn PosHardwareRepository>,
    gateway_secret: String,
}

impl PosHardwareHandler {
    pub fn new(repository: Arc<dyn PosHardwareRepository>, gateway_secret: String) -> Self {
        Self {
            repository,
            gateway_secret,
        }
    }

    pub async fn create_terminal(
        &self,
        tenant_id: Uuid,
        payload: CreateTerminalRequest,
    ) -> Result<PosTerminalResponse, PosHardwareError> {
        if payload.code.trim().is_empty() {
            return Err(PosHardwareError::Domain(DomainError::ValidationError(
                "O código do terminal POS é obrigatório.".to_string(),
            )));
        }

        let terminal = self.repository.create_terminal(tenant_id, &payload).await?;
        Ok(terminal.into())
    }

    pub async fn list_terminals(
        &self,
        tenant_id: Uuid,
    ) -> Result<PosTerminalListResponse, PosHardwareError> {
        let terminals = self.repository.list_terminals(tenant_id).await?;
        Ok(PosTerminalListResponse {
            terminals: terminals.into_iter().map(Into::into).collect(),
        })
    }

    pub async fn create_pairing_token(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
        created_by_user_id: &str,
    ) -> Result<PairingTokenResponse, PosHardwareError> {
        let token = random_hex(32)?;
        let token_hash = Sha256::digest(token.as_bytes()).to_vec();
        let expires_at = Utc::now() + Duration::seconds(PAIRING_TOKEN_TTL_SECONDS);

        self.repository
            .create_pairing_token(
                tenant_id,
                terminal_id,
                &token_hash,
                expires_at,
                created_by_user_id,
            )
            .await?;

        Ok(PairingTokenResponse { token, expires_at })
    }

    pub async fn revoke_terminal(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
    ) -> Result<RevokeTerminalResponse, PosHardwareError> {
        let status: TerminalStatus = self
            .repository
            .revoke_terminal(tenant_id, terminal_id)
            .await?;
        Ok(RevokeTerminalResponse {
            status: status.status,
            credential_epoch: status.credential_epoch,
        })
    }

    pub async fn bootstrap(
        &self,
        payload: BootstrapRequest,
    ) -> Result<BootstrapResponse, PosHardwareError> {
        if !is_valid_activation_token(&payload.activation_token) {
            return Err(PosHardwareError::InvalidToken);
        }

        let token_hash = Sha256::digest(payload.activation_token.as_bytes()).to_vec();
        let lookup = self
            .repository
            .find_pairing_token(&token_hash)
            .await?
            .ok_or(PosHardwareError::InvalidToken)?;

        if lookup.consumed_at.is_some() {
            return Err(PosHardwareError::AlreadyConsumed);
        }
        if lookup.revoked_at.is_some() || lookup.terminal_status == "REVOKED" {
            return Err(self.record_failure(&lookup, &token_hash).await);
        }
        if lookup.expires_at <= Utc::now() {
            return Err(PosHardwareError::ExpiredToken);
        }
        if lookup.failed_attempts >= MAX_PAIRING_ATTEMPTS {
            return Err(PosHardwareError::Locked);
        }

        let consumed = self
            .repository
            .consume_pairing_token(&lookup, &token_hash)
            .await?
            .ok_or(PosHardwareError::AlreadyConsumed)?;

        let token = local_token(
            &self.gateway_secret,
            consumed.tenant_id,
            consumed.terminal_id,
            consumed.credential_epoch,
        )?;

        Ok(BootstrapResponse {
            token,
            tenant_id: consumed.tenant_id,
            terminal_id: consumed.terminal_id,
            credential_epoch: consumed.credential_epoch,
            seed: build_seed(),
        })
    }

    pub async fn pairing_status(
        &self,
        terminal_id: Uuid,
    ) -> Result<PairingStatusResponse, PosHardwareError> {
        let terminal = self
            .repository
            .resolve_terminal(terminal_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Terminal POS não encontrado.".to_string()))?;
        let status = self
            .repository
            .get_terminal_status(terminal.tenant_id, terminal_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Terminal POS não encontrado.".to_string()))?;

        Ok(PairingStatusResponse {
            status: status.status,
            credential_epoch: status.credential_epoch,
        })
    }

    pub fn seed(&self) -> Result<SeedResponse, PosHardwareError> {
        signed_seed(&build_seed(), &self.gateway_secret)
    }

    async fn record_failure(
        &self,
        lookup: &PairingTokenLookup,
        token_hash: &[u8],
    ) -> PosHardwareError {
        match self
            .repository
            .register_failed_attempt(lookup, token_hash)
            .await
        {
            Ok(attempts) if attempts >= MAX_PAIRING_ATTEMPTS => PosHardwareError::Locked,
            Ok(_) => PosHardwareError::InvalidToken,
            Err(err) => PosHardwareError::Domain(err),
        }
    }
}

fn is_valid_activation_token(token: &str) -> bool {
    token.len() == 64 && token.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn random_hex(length: usize) -> Result<String, PosHardwareError> {
    let mut bytes = vec![0u8; length];
    SystemRandom::new().fill(&mut bytes).map_err(|_| {
        PosHardwareError::Domain(DomainError::ValidationError(
            "Não foi possível gerar um token seguro.".to_string(),
        ))
    })?;
    Ok(hex_lower(&bytes))
}

fn hex_lower(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    output
}

fn local_token(
    secret: &str,
    tenant_id: Uuid,
    terminal_id: Uuid,
    credential_epoch: i64,
) -> Result<String, PosHardwareError> {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hasher.update(tenant_id.as_bytes());
    hasher.update(terminal_id.as_bytes());
    hasher.update(credential_epoch.to_string().as_bytes());
    Ok(hex_lower(&hasher.finalize()))
}

fn build_seed() -> SeedPayload {
    SeedPayload {
        version: 1,
        expires_at: current_seed_expiry(),
        catalog: Vec::<SeedItem>::new(),
        series: Vec::<Value>::new(),
    }
}

fn current_seed_expiry() -> DateTime<Utc> {
    Utc::now() + Duration::hours(SEED_TTL_HOURS)
}

fn signed_seed(seed: &SeedPayload, secret: &str) -> Result<SeedResponse, PosHardwareError> {
    let payload =
        serde_json::to_value(seed).map_err(|err| DomainError::ValidationError(err.to_string()))?;
    let bytes = canonical_json_bytes(&payload)
        .map_err(|err| DomainError::ValidationError(err.to_string()))?;
    let signature = compute_payload_signature(secret, &bytes);

    Ok(SeedResponse {
        version: seed.version,
        expires_at: seed.expires_at,
        signature,
        catalog: seed.catalog.clone(),
        series: seed.series.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_tokens_are_32_lowercase_hex_bytes() {
        let token = random_hex(32).unwrap();
        assert_eq!(token.len(), 64);
        assert!(is_valid_activation_token(&token));
        assert!(token.bytes().all(|byte| !byte.is_ascii_uppercase()));
    }

    #[test]
    fn activation_hash_uses_sha256() {
        let hash = hex_lower(&Sha256::digest(b"abc"));
        assert_eq!(
            hash,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn local_token_changes_with_credential_epoch() {
        let tenant = Uuid::new_v4();
        let terminal = Uuid::new_v4();
        let first = local_token("secret", tenant, terminal, 1).unwrap();
        let second = local_token("secret", tenant, terminal, 2).unwrap();
        assert_ne!(first, second);
        assert_eq!(first.len(), 64);
        assert!(first.bytes().all(|byte| !byte.is_ascii_uppercase()));
    }

    #[test]
    fn seed_signature_covers_canonical_payload() {
        let seed = build_seed();
        let signed = signed_seed(&seed, "test-secret").unwrap();
        let payload = serde_json::to_value(&seed).unwrap();
        let bytes = canonical_json_bytes(&payload).unwrap();
        assert_eq!(
            signed.signature,
            compute_payload_signature("test-secret", &bytes)
        );
        assert_eq!(signed.version, 1);
        assert!(signed.catalog.is_empty());
        assert!(signed.series.is_empty());
    }
}
