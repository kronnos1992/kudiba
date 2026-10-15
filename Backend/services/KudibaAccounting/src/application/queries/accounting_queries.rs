use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::entities::{Account, FiscalYear, Journal, JournalEntry};
use crate::domain::error::DomainError;
use crate::domain::ports::{
    AccountRepository, FiscalYearRepository, JournalEntryRepository, JournalRepository,
};
use crate::domain::services::{TrialBalanceCalculator, TrialBalanceReport};

pub struct AccountingQueries {
    account_repo: Arc<dyn AccountRepository>,
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl AccountingQueries {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        entry_repo: Arc<dyn JournalEntryRepository>,
        journal_repo: Arc<dyn JournalRepository>,
        year_repo: Arc<dyn FiscalYearRepository>,
    ) -> Self {
        Self {
            account_repo,
            entry_repo,
            journal_repo,
            year_repo,
        }
    }

    pub async fn get_chart(&self, tenant_id: Uuid) -> Result<Vec<Account>, DomainError> {
        self.account_repo.list_all(tenant_id).await
    }

    pub async fn list_entries(
        &self,
        tenant_id: Uuid,
        journal_id: Option<Uuid>,
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<JournalEntry>, DomainError> {
        self.entry_repo
            .list_entries(tenant_id, journal_id, from_date, to_date, limit, offset)
            .await
    }

    pub async fn get_entry(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<JournalEntry>, DomainError> {
        self.entry_repo.find_by_id(tenant_id, id).await
    }

    pub async fn get_trial_balance(
        &self,
        tenant_id: Uuid,
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
    ) -> Result<TrialBalanceReport, DomainError> {
        let accounts = self.account_repo.list_all(tenant_id).await?;
        let (opening_entries, period_entries) = if let Some(fd) = from_date {
            let prior_to_date = fd.pred_opt();
            let opening = self
                .entry_repo
                .list_entries(tenant_id, None, None, prior_to_date, 100_000, 0)
                .await?;
            let period = self
                .entry_repo
                .list_entries(tenant_id, None, Some(fd), to_date, 100_000, 0)
                .await?;
            (opening, period)
        } else {
            let period = self
                .entry_repo
                .list_entries(tenant_id, None, None, to_date, 100_000, 0)
                .await?;
            (Vec::new(), period)
        };

        Ok(TrialBalanceCalculator::calculate_with_opening(
            &accounts,
            &opening_entries,
            &period_entries,
        ))
    }

    pub async fn list_journals(&self, tenant_id: Uuid) -> Result<Vec<Journal>, DomainError> {
        self.journal_repo.list_all(tenant_id).await
    }

    pub async fn list_fiscal_years(&self, tenant_id: Uuid) -> Result<Vec<FiscalYear>, DomainError> {
        self.year_repo.list_all(tenant_id).await
    }
}
