use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::error::DeviceError;
use crate::domain::job::PrintJob;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportOutcome {
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
    async fn find_by_idempotency_key(&self, key: &str) -> Result<Option<PrintJob>, DeviceError>;
}
