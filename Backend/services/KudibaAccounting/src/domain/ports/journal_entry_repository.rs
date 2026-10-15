use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::domain::entities::JournalEntry;
use crate::domain::error::DomainError;

#[async_trait]
pub trait JournalEntryRepository: Send + Sync {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<JournalEntry>, DomainError>;
    async fn find_by_source_ref(
        &self,
        tenant_id: Uuid,
        source_ref: &str,
    ) -> Result<Option<JournalEntry>, DomainError>;
    async fn list_entries(
        &self,
        tenant_id: Uuid,
        journal_id: Option<Uuid>,
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<JournalEntry>, DomainError>;
    async fn save(&self, entry: &JournalEntry) -> Result<(), DomainError>;
    async fn save_with_event(
        &self,
        entry: &JournalEntry,
        event_id: Option<Uuid>,
        event_type: Option<&str>,
        source_ref: Option<&str>,
    ) -> Result<(), DomainError>;
    async fn is_event_processed(
        &self,
        tenant_id: Uuid,
        event_id: Uuid,
    ) -> Result<bool, DomainError>;
    async fn mark_event_processed(
        &self,
        tenant_id: Uuid,
        event_id: Uuid,
        event_type: &str,
        source_ref: &str,
    ) -> Result<(), DomainError>;
}
