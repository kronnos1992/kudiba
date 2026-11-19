use std::collections::HashMap;
use std::sync::Mutex;

use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::error::DeviceError;
use crate::domain::job::PrintJob;
use crate::domain::port::{
    CloudBootstrap, CloudBootstrapPort, CloudTerminalStatus, DrawerPort, JobRepository,
    PrinterPort, ScannerPort, SeedDocument, SeedRepository, TransportOutcome,
};
use crate::domain::seed::{CatalogItem, SeedPayload};

#[derive(Default)]
pub struct InMemoryJobRepository {
    jobs: Mutex<HashMap<Uuid, PrintJob>>,
}

#[async_trait]
impl JobRepository for InMemoryJobRepository {
    async fn save(&self, job: PrintJob) -> Result<(), DeviceError> {
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| DeviceError::Busy("repositório".into()))?;
        if let Some(existing) = jobs.values().find(|j| {
            j.tenant_id() == job.tenant_id() && j.idempotency_key() == job.idempotency_key()
        }) {
            if existing.id() != job.id() {
                return Err(DeviceError::Busy("chave de idempotência duplicada".into()));
            }
        }
        jobs.insert(job.id(), job);
        Ok(())
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<PrintJob>, DeviceError> {
        let jobs = self
            .jobs
            .lock()
            .map_err(|_| DeviceError::Busy("repositório".into()))?;
        Ok(jobs.get(&id).cloned())
    }

    async fn find_by_idempotency_key(
        &self,
        tenant_id: Uuid,
        key: &str,
    ) -> Result<Option<PrintJob>, DeviceError> {
        let jobs = self
            .jobs
            .lock()
            .map_err(|_| DeviceError::Busy("repositório".into()))?;
        Ok(jobs
            .values()
            .find(|j| j.tenant_id() == tenant_id && j.idempotency_key() == key)
            .cloned())
    }
}

pub struct RecordingPrinter {
    pub received: Mutex<Vec<Vec<u8>>>,
    outcome: TransportOutcome,
}

impl RecordingPrinter {
    pub fn new(outcome: TransportOutcome) -> Self {
        Self {
            received: Mutex::new(Vec::new()),
            outcome,
        }
    }
}

#[async_trait]
impl PrinterPort for RecordingPrinter {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        let mut received = self
            .received
            .lock()
            .map_err(|_| DeviceError::Busy("impressora".into()))?;
        received.push(bytes.to_vec());
        Ok(self.outcome)
    }
}

#[derive(Default)]
pub struct RecordingDrawer {
    pub calls: Mutex<u32>,
    outcome: TransportOutcome,
}

impl RecordingDrawer {
    pub fn new(outcome: TransportOutcome) -> Self {
        Self {
            calls: Mutex::new(0),
            outcome,
        }
    }
}

#[async_trait]
impl DrawerPort for RecordingDrawer {
    async fn open(&self) -> Result<TransportOutcome, DeviceError> {
        let mut calls = self
            .calls
            .lock()
            .map_err(|_| DeviceError::Busy("gaveta".into()))?;
        *calls += 1;
        Ok(self.outcome)
    }
}

pub struct StaticCloudBootstrap {
    bootstrap: CloudBootstrap,
    document: SeedDocument,
}

impl StaticCloudBootstrap {
    pub fn new(bootstrap: CloudBootstrap, document: SeedDocument) -> Self {
        Self {
            bootstrap,
            document,
        }
    }
}

#[async_trait]
impl CloudBootstrapPort for StaticCloudBootstrap {
    async fn bootstrap(
        &self,
        _activation_token: &str,
        _label: &str,
    ) -> Result<CloudBootstrap, DeviceError> {
        Ok(self.bootstrap.clone())
    }

    async fn terminal_status(
        &self,
        _terminal_id: Uuid,
    ) -> Result<CloudTerminalStatus, DeviceError> {
        Ok(CloudTerminalStatus {
            status: "ACTIVE".to_string(),
            credential_epoch: self.bootstrap.credential_epoch,
        })
    }

    async fn seed(&self) -> Result<SeedDocument, DeviceError> {
        Ok(self.document.clone())
    }
}

#[derive(Default)]
pub struct InMemorySeedRepository {
    seed: Mutex<Option<SeedPayload>>,
}

#[async_trait]
impl SeedRepository for InMemorySeedRepository {
    async fn apply(
        &self,
        seed: &SeedPayload,
        _signature: &str,
        _secret: &str,
    ) -> Result<(), DeviceError> {
        *self
            .seed
            .lock()
            .map_err(|_| DeviceError::Busy("seed".into()))? = Some(seed.clone());
        Ok(())
    }

    async fn current(&self) -> Result<Option<SeedPayload>, DeviceError> {
        Ok(self
            .seed
            .lock()
            .map_err(|_| DeviceError::Busy("seed".into()))?
            .clone())
    }

    async fn catalog(&self) -> Result<Vec<CatalogItem>, DeviceError> {
        Ok(self
            .seed
            .lock()
            .map_err(|_| DeviceError::Busy("seed".into()))?
            .as_ref()
            .map(|seed| seed.catalog.clone())
            .unwrap_or_default())
    }
}

#[derive(Default)]
pub struct RecordingScanner {
    pub codes: Mutex<Vec<String>>,
}

#[async_trait]
impl ScannerPort for RecordingScanner {
    async fn submit(&self, code: &str) -> Result<(), DeviceError> {
        self.codes
            .lock()
            .map_err(|_| DeviceError::Busy("leitor".into()))?
            .push(code.trim().to_string());
        Ok(())
    }

    async fn last_code(&self) -> Option<String> {
        self.codes
            .lock()
            .ok()
            .and_then(|codes| codes.last().cloned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::job::JobClass;

    fn job(key: &str) -> PrintJob {
        PrintJob::new_original(
            Uuid::from_u128(1),
            Uuid::from_u128(2),
            JobClass::FiscalEnvelope,
            "FT 2026A/000123",
            key,
            "sha256:abc",
        )
        .unwrap()
    }

    #[tokio::test]
    async fn repository_rejects_a_duplicate_idempotency_key() {
        let repository = InMemoryJobRepository::default();
        let first = job("sale-1");
        let id = first.id();
        repository.save(first).await.unwrap();

        let mut second = job("sale-1");
        second.mark_submitting().unwrap();
        assert!(matches!(
            repository.save(second).await,
            Err(DeviceError::Busy(_))
        ));

        let stored = repository.find_by_id(id).await.unwrap().unwrap();
        assert_eq!(stored.state(), crate::domain::job::PrintState::Queued);
    }

    #[tokio::test]
    async fn repository_finds_by_idempotency_key() {
        let repository = InMemoryJobRepository::default();
        let job = job("sale-2");
        let id = job.id();
        repository.save(job).await.unwrap();

        let found = repository
            .find_by_idempotency_key(Uuid::from_u128(1), "sale-2")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(found.id(), id);
        assert!(repository
            .find_by_idempotency_key(Uuid::from_u128(1), "missing")
            .await
            .unwrap()
            .is_none());
        assert!(repository
            .find_by_idempotency_key(Uuid::from_u128(9), "sale-2")
            .await
            .unwrap()
            .is_none());
    }
}
