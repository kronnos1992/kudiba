use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DeviceError;
use crate::domain::job::PrintJob;
use crate::domain::seed::{CatalogItem, SeedPayload};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TransportOutcome {
    #[default]
    TransportAccepted,
    Failed,
    Unknown,
}

#[async_trait]
pub trait PrinterPort: Send + Sync {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError>;
}

#[async_trait]
pub trait DrawerPort: Send + Sync {
    async fn open(&self) -> Result<TransportOutcome, DeviceError>;
}

#[async_trait]
pub trait JobRepository: Send + Sync {
    async fn save(&self, job: PrintJob) -> Result<(), DeviceError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<PrintJob>, DeviceError>;
    async fn find_by_idempotency_key(
        &self,
        tenant_id: Uuid,
        key: &str,
    ) -> Result<Option<PrintJob>, DeviceError>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBootstrap {
    pub token: String,
    pub tenant_id: Uuid,
    pub terminal_id: Uuid,
    pub credential_epoch: i64,
    pub seed: SeedPayload,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudTerminalStatus {
    pub status: String,
    pub credential_epoch: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedDocument {
    pub seed: SeedPayload,
    pub signature: String,
}

#[async_trait]
pub trait CloudBootstrapPort: Send + Sync {
    async fn bootstrap(
        &self,
        activation_token: &str,
        label: &str,
    ) -> Result<CloudBootstrap, DeviceError>;
    async fn terminal_status(&self, terminal_id: Uuid) -> Result<CloudTerminalStatus, DeviceError>;
    async fn seed(&self) -> Result<SeedDocument, DeviceError>;
}

#[async_trait]
pub trait SeedRepository: Send + Sync {
    async fn apply(
        &self,
        seed: &SeedPayload,
        signature: &str,
        secret: &str,
    ) -> Result<(), DeviceError>;
    async fn current(&self) -> Result<Option<SeedPayload>, DeviceError>;
    async fn catalog(&self) -> Result<Vec<CatalogItem>, DeviceError>;
}

#[async_trait]
pub trait ScannerPort: Send + Sync {
    async fn submit(&self, code: &str) -> Result<(), DeviceError>;
    async fn last_code(&self) -> Option<String>;
}
