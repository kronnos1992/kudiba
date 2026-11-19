use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Error)]
pub enum PosHardwareError {
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error("Token de emparelhamento inválido.")]
    InvalidToken,
    #[error("Token de emparelhamento expirado.")]
    ExpiredToken,
    #[error("Token de emparelhamento bloqueado após cinco tentativas.")]
    Locked,
    #[error("Token de emparelhamento já consumido.")]
    AlreadyConsumed,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalRequest {
    pub code: String,
    pub name: Option<String>,
    pub warehouse_id: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapRequest {
    pub activation_token: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PosTerminalResponse {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PosTerminalListResponse {
    pub terminals: Vec<PosTerminalResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingTokenResponse {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeTerminalResponse {
    pub status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedItem {
    pub barcode: String,
    pub code: String,
    pub description: String,
    pub price: Decimal,
    pub tax_rate: Decimal,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedPayload {
    pub version: i32,
    pub expires_at: DateTime<Utc>,
    pub catalog: Vec<SeedItem>,
    pub series: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedResponse {
    pub version: i32,
    pub expires_at: DateTime<Utc>,
    pub signature: String,
    pub catalog: Vec<SeedItem>,
    pub series: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapResponse {
    pub token: String,
    pub tenant_id: Uuid,
    pub terminal_id: Uuid,
    pub credential_epoch: i64,
    pub seed: SeedPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingStatusResponse {
    pub status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone)]
pub struct PosTerminal {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub warehouse_id: Option<Uuid>,
    pub status: String,
    pub credential_epoch: i64,
    pub paired_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<PosTerminal> for PosTerminalResponse {
    fn from(terminal: PosTerminal) -> Self {
        Self {
            id: terminal.id,
            code: terminal.code,
            name: terminal.name,
            status: terminal.status,
            credential_epoch: terminal.credential_epoch,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PairingTokenLookup {
    pub tenant_id: Uuid,
    pub terminal_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub consumed_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub failed_attempts: i16,
    pub terminal_status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone)]
pub struct ConsumedPairing {
    pub tenant_id: Uuid,
    pub terminal_id: Uuid,
    pub status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone)]
pub struct TerminalStatus {
    pub status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone)]
pub struct TerminalLookup {
    pub tenant_id: Uuid,
    pub status: String,
    pub credential_epoch: i64,
}
