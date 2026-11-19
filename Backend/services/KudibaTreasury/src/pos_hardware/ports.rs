use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::pos_hardware::domain::{
    ConsumedPairing, CreateTerminalRequest, PairingTokenLookup, PosTerminal, TerminalLookup,
    TerminalStatus,
};

#[async_trait]
pub trait PosHardwareRepository: Send + Sync {
    async fn create_terminal(
        &self,
        tenant_id: Uuid,
        payload: &CreateTerminalRequest,
    ) -> Result<PosTerminal, DomainError>;

    async fn list_terminals(&self, tenant_id: Uuid) -> Result<Vec<PosTerminal>, DomainError>;

    async fn create_pairing_token(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
        token_hash: &[u8],
        expires_at: chrono::DateTime<chrono::Utc>,
        created_by_user_id: &str,
    ) -> Result<(), DomainError>;

    async fn revoke_terminal(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
    ) -> Result<TerminalStatus, DomainError>;

    async fn find_pairing_token(
        &self,
        token_hash: &[u8],
    ) -> Result<Option<PairingTokenLookup>, DomainError>;

    async fn register_failed_attempt(
        &self,
        lookup: &PairingTokenLookup,
        token_hash: &[u8],
    ) -> Result<i16, DomainError>;

    async fn consume_pairing_token(
        &self,
        lookup: &PairingTokenLookup,
        token_hash: &[u8],
    ) -> Result<Option<ConsumedPairing>, DomainError>;

    async fn get_terminal_status(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
    ) -> Result<Option<TerminalStatus>, DomainError>;

    async fn resolve_terminal(
        &self,
        terminal_id: Uuid,
    ) -> Result<Option<TerminalLookup>, DomainError>;
}
