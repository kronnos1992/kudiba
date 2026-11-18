use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DeviceError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JobClass {
    FiscalEnvelope,
    ContingencyLocal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CopyType {
    Original,
    Copy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PrintState {
    Queued,
    Submitting,
    TransportAccepted,
    Failed,
    Unknown,
    PhysicalOutputConfirmed,
    ResolvedByOperator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintJob {
    id: Uuid,
    tenant_id: Uuid,
    terminal_id: Uuid,
    job_class: JobClass,
    copy_type: CopyType,
    document_number: String,
    idempotency_key: String,
    payload_hash: String,
    state: PrintState,
    attempts: u32,
    created_at: DateTime<Utc>,
}

impl PrintJob {
    pub fn new_original(
        tenant_id: Uuid,
        terminal_id: Uuid,
        job_class: JobClass,
        document_number: impl Into<String>,
        idempotency_key: impl Into<String>,
        payload_hash: impl Into<String>,
    ) -> Result<Self, DeviceError> {
        let document_number = document_number.into();
        let idempotency_key = idempotency_key.into();
        let payload_hash = payload_hash.into();

        if document_number.trim().is_empty() {
            return Err(DeviceError::EmptyField("document_number"));
        }
        if idempotency_key.trim().is_empty() {
            return Err(DeviceError::InvalidIdempotencyKey);
        }
        if payload_hash.trim().is_empty() {
            return Err(DeviceError::EmptyField("payload_hash"));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            terminal_id,
            job_class,
            copy_type: CopyType::Original,
            document_number,
            idempotency_key,
            payload_hash,
            state: PrintState::Queued,
            attempts: 0,
            created_at: Utc::now(),
        })
    }

    pub fn new_copy(&self, idempotency_key: impl Into<String>) -> Result<Self, DeviceError> {
        let idempotency_key = idempotency_key.into();
        if idempotency_key.trim().is_empty() || idempotency_key == self.idempotency_key {
            return Err(DeviceError::InvalidIdempotencyKey);
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id: self.tenant_id,
            terminal_id: self.terminal_id,
            job_class: self.job_class,
            copy_type: CopyType::Copy,
            document_number: self.document_number.clone(),
            idempotency_key,
            payload_hash: self.payload_hash.clone(),
            state: PrintState::Queued,
            attempts: 0,
            created_at: Utc::now(),
        })
    }

    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn tenant_id(&self) -> Uuid {
        self.tenant_id
    }

    pub fn terminal_id(&self) -> Uuid {
        self.terminal_id
    }

    pub fn job_class(&self) -> JobClass {
        self.job_class
    }

    pub fn copy_type(&self) -> CopyType {
        self.copy_type
    }

    pub fn document_number(&self) -> &str {
        &self.document_number
    }

    pub fn idempotency_key(&self) -> &str {
        &self.idempotency_key
    }

    pub fn payload_hash(&self) -> &str {
        &self.payload_hash
    }

    pub fn state(&self) -> PrintState {
        self.state
    }

    pub fn attempts(&self) -> u32 {
        self.attempts
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn is_fiscal(&self) -> bool {
        self.job_class == JobClass::FiscalEnvelope
    }

    pub fn allows_drawer(&self) -> bool {
        self.copy_type == CopyType::Original && self.is_terminal_success()
    }

    pub fn is_terminal_success(&self) -> bool {
        matches!(
            self.state,
            PrintState::TransportAccepted
                | PrintState::PhysicalOutputConfirmed
                | PrintState::ResolvedByOperator
        )
    }

    pub fn can_auto_retry(&self) -> bool {
        self.state == PrintState::Failed
    }

    pub fn mark_submitting(&mut self) -> Result<(), DeviceError> {
        self.transition(PrintState::Queued, PrintState::Submitting)?;
        self.attempts += 1;
        Ok(())
    }

    pub fn mark_transport_accepted(&mut self) -> Result<(), DeviceError> {
        self.transition(PrintState::Submitting, PrintState::TransportAccepted)
    }

    pub fn mark_failed(&mut self) -> Result<(), DeviceError> {
        self.transition(PrintState::Submitting, PrintState::Failed)
    }

    pub fn mark_unknown(&mut self) -> Result<(), DeviceError> {
        self.transition(PrintState::Submitting, PrintState::Unknown)
    }

    pub fn requeue_after_failure(&mut self) -> Result<(), DeviceError> {
        self.transition(PrintState::Failed, PrintState::Queued)
    }

    pub fn confirm_physical_output(&mut self) -> Result<(), DeviceError> {
        self.transition(
            PrintState::TransportAccepted,
            PrintState::PhysicalOutputConfirmed,
        )
    }

    pub fn resolve_by_operator(&mut self) -> Result<(), DeviceError> {
        match self.state {
            PrintState::Unknown | PrintState::Failed | PrintState::TransportAccepted => {
                self.state = PrintState::ResolvedByOperator;
                Ok(())
            }
            _ => Err(DeviceError::InvalidTransition(
                self.state,
                PrintState::ResolvedByOperator,
            )),
        }
    }

    fn transition(&mut self, from: PrintState, to: PrintState) -> Result<(), DeviceError> {
        if self.state != from {
            return Err(DeviceError::InvalidTransition(self.state, to));
        }
        self.state = to;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job() -> PrintJob {
        PrintJob::new_original(
            Uuid::new_v4(),
            Uuid::new_v4(),
            JobClass::FiscalEnvelope,
            "FT 2026A/000123",
            "sale-123-original",
            "sha256:abc",
        )
        .unwrap()
    }

    #[test]
    fn original_starts_queued_and_only_allows_drawer_after_success() {
        let mut job = job();
        assert_eq!(job.state(), PrintState::Queued);
        assert_eq!(job.copy_type(), CopyType::Original);
        assert!(job.is_fiscal());
        assert!(!job.allows_drawer());
        assert_eq!(job.attempts(), 0);

        job.mark_submitting().unwrap();
        job.mark_transport_accepted().unwrap();
        assert!(job.allows_drawer());
    }

    #[test]
    fn new_copy_keeps_document_and_hash_but_uses_a_fresh_key() {
        let original = job();
        let copy = original.new_copy("sale-123-copy").unwrap();

        assert_ne!(copy.id(), original.id());
        assert_eq!(copy.document_number(), original.document_number());
        assert_eq!(copy.payload_hash(), original.payload_hash());
        assert_eq!(copy.tenant_id(), original.tenant_id());
        assert_eq!(copy.terminal_id(), original.terminal_id());
        assert_eq!(copy.copy_type(), CopyType::Copy);
        assert_eq!(copy.idempotency_key(), "sale-123-copy");
        assert_ne!(copy.idempotency_key(), original.idempotency_key());
        assert!(!copy.allows_drawer());
    }

    #[test]
    fn copy_cannot_reuse_the_original_key() {
        let original = job();
        assert!(matches!(
            original.new_copy("sale-123-original"),
            Err(DeviceError::InvalidIdempotencyKey)
        ));
    }

    #[test]
    fn empty_fields_are_rejected() {
        let tenant = Uuid::new_v4();
        let terminal = Uuid::new_v4();
        assert!(matches!(
            PrintJob::new_original(tenant, terminal, JobClass::FiscalEnvelope, "", "k", "h"),
            Err(DeviceError::EmptyField("document_number"))
        ));
        assert!(matches!(
            PrintJob::new_original(tenant, terminal, JobClass::FiscalEnvelope, "d", " ", "h"),
            Err(DeviceError::InvalidIdempotencyKey)
        ));
        assert!(matches!(
            PrintJob::new_original(tenant, terminal, JobClass::FiscalEnvelope, "d", "k", ""),
            Err(DeviceError::EmptyField("payload_hash"))
        ));
    }

    #[test]
    fn unknown_blocks_automatic_retry() {
        let mut job = job();
        job.mark_submitting().unwrap();
        job.mark_unknown().unwrap();

        assert_eq!(job.state(), PrintState::Unknown);
        assert!(!job.can_auto_retry());
        assert!(matches!(
            job.requeue_after_failure(),
            Err(DeviceError::InvalidTransition(
                PrintState::Unknown,
                PrintState::Queued
            ))
        ));
        assert_eq!(job.state(), PrintState::Unknown);

        job.resolve_by_operator().unwrap();
        assert_eq!(job.state(), PrintState::ResolvedByOperator);
    }

    #[test]
    fn failed_can_be_requeued_and_counts_attempts() {
        let mut job = job();
        job.mark_submitting().unwrap();
        job.mark_failed().unwrap();
        assert!(job.can_auto_retry());
        assert_eq!(job.attempts(), 1);

        job.requeue_after_failure().unwrap();
        job.mark_submitting().unwrap();
        assert_eq!(job.state(), PrintState::Submitting);
        assert_eq!(job.attempts(), 2);
    }

    #[test]
    fn transport_acceptance_requires_explicit_physical_confirmation() {
        let mut job = job();
        job.mark_submitting().unwrap();
        job.mark_transport_accepted().unwrap();

        assert_eq!(job.state(), PrintState::TransportAccepted);
        assert!(matches!(
            job.mark_submitting(),
            Err(DeviceError::InvalidTransition(
                PrintState::TransportAccepted,
                PrintState::Submitting
            ))
        ));

        job.confirm_physical_output().unwrap();
        assert_eq!(job.state(), PrintState::PhysicalOutputConfirmed);
    }

    #[test]
    fn contingency_jobs_are_not_fiscal() {
        let job = PrintJob::new_original(
            Uuid::new_v4(),
            Uuid::new_v4(),
            JobClass::ContingencyLocal,
            "CONT-0001",
            "contingency-1",
            "sha256:def",
        )
        .unwrap();

        assert!(!job.is_fiscal());
        assert!(!job.allows_drawer());
    }
}
