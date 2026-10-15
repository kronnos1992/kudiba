use chrono::NaiveDate;
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::entities::{FiscalYear, Journal, JournalEntry};
use crate::domain::error::DomainError;
use crate::domain::ports::{FiscalYearRepository, JournalEntryRepository, JournalRepository};
use crate::domain::services::AccountingRulesService;
use crate::domain::value_objects::JournalType;

pub struct ProcessInvoiceIssuedCommand {
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl ProcessInvoiceIssuedCommand {
    pub fn new(
        entry_repo: Arc<dyn JournalEntryRepository>,
        journal_repo: Arc<dyn JournalRepository>,
        year_repo: Arc<dyn FiscalYearRepository>,
    ) -> Self {
        Self {
            entry_repo,
            journal_repo,
            year_repo,
        }
    }

    pub async fn execute(
        &self,
        event_id: Uuid,
        tenant_id: Uuid,
        doc_type: &str,
        doc_number: &str,
        customer_name: &str,
        issue_date: NaiveDate,
        net_total: Decimal,
        tax_total: Decimal,
        retention_total: Decimal,
        gross_total: Decimal,
    ) -> Result<Option<JournalEntry>, DomainError> {
        // 1. Idempotência estrita
        if self
            .entry_repo
            .is_event_processed(tenant_id, event_id)
            .await?
        {
            return Ok(None);
        }

        // 2. Obter ou auto-criar exercício fiscal
        let year_code = issue_date
            .format("%Y")
            .to_string()
            .parse::<i32>()
            .unwrap_or(2026);
        let fiscal_year = match self.year_repo.find_by_year(tenant_id, year_code).await? {
            Some(y) => y,
            None => {
                let new_y = FiscalYear::new(tenant_id, year_code)?;
                self.year_repo.save(&new_y).await?;
                new_y
            }
        };

        // 3. Obter ou auto-criar diário de vendas (VEND)
        let journal = match self.journal_repo.find_by_code(tenant_id, "VEND").await? {
            Some(j) => j,
            None => {
                let new_j = Journal::new(
                    tenant_id,
                    "VEND".to_string(),
                    "Diário de Vendas".to_string(),
                    JournalType::Sales,
                )?;
                self.journal_repo.save(&new_j).await?;
                new_j
            }
        };

        let period = issue_date
            .format("%m")
            .to_string()
            .parse::<i32>()
            .unwrap_or(1);
        let next_num = self
            .journal_repo
            .next_entry_number(tenant_id, &journal.code, year_code)
            .await?;

        let entry = AccountingRulesService::create_invoice_entry(
            tenant_id,
            fiscal_year.id,
            journal.id,
            next_num,
            issue_date,
            period,
            doc_type,
            doc_number,
            customer_name,
            net_total,
            tax_total,
            retention_total,
            gross_total,
        )?;

        self.entry_repo.save(&entry).await?;
        self.entry_repo
            .mark_event_processed(tenant_id, event_id, "fiscal.document.issued", doc_number)
            .await?;

        Ok(Some(entry))
    }
}

pub struct ProcessStockDispatchCommand {
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl ProcessStockDispatchCommand {
    pub fn new(
        entry_repo: Arc<dyn JournalEntryRepository>,
        journal_repo: Arc<dyn JournalRepository>,
        year_repo: Arc<dyn FiscalYearRepository>,
    ) -> Self {
        Self {
            entry_repo,
            journal_repo,
            year_repo,
        }
    }

    pub async fn execute(
        &self,
        event_id: Uuid,
        tenant_id: Uuid,
        doc_ref: &str,
        movement_date: NaiveDate,
        cmp_total_cost: Decimal,
    ) -> Result<Option<JournalEntry>, DomainError> {
        if self
            .entry_repo
            .is_event_processed(tenant_id, event_id)
            .await?
        {
            return Ok(None);
        }

        let year_code = movement_date
            .format("%Y")
            .to_string()
            .parse::<i32>()
            .unwrap_or(2026);
        let fiscal_year = match self.year_repo.find_by_year(tenant_id, year_code).await? {
            Some(y) => y,
            None => {
                let new_y = FiscalYear::new(tenant_id, year_code)?;
                self.year_repo.save(&new_y).await?;
                new_y
            }
        };

        let journal = match self.journal_repo.find_by_code(tenant_id, "OD").await? {
            Some(j) => j,
            None => {
                let new_j = Journal::new(
                    tenant_id,
                    "OD".to_string(),
                    "Operações Diversas".to_string(),
                    JournalType::Operations,
                )?;
                self.journal_repo.save(&new_j).await?;
                new_j
            }
        };

        let period = movement_date
            .format("%m")
            .to_string()
            .parse::<i32>()
            .unwrap_or(1);
        let next_num = self
            .journal_repo
            .next_entry_number(tenant_id, &journal.code, year_code)
            .await?;

        let entry = AccountingRulesService::create_stock_dispatch_entry(
            tenant_id,
            fiscal_year.id,
            journal.id,
            next_num,
            movement_date,
            period,
            doc_ref,
            cmp_total_cost,
        )?;

        self.entry_repo.save(&entry).await?;
        self.entry_repo
            .mark_event_processed(tenant_id, event_id, "inventory.stock_dispatch", doc_ref)
            .await?;

        Ok(Some(entry))
    }
}

pub struct ProcessTreasuryReceiptCommand {
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl ProcessTreasuryReceiptCommand {
    pub fn new(
        entry_repo: Arc<dyn JournalEntryRepository>,
        journal_repo: Arc<dyn JournalRepository>,
        year_repo: Arc<dyn FiscalYearRepository>,
    ) -> Self {
        Self {
            entry_repo,
            journal_repo,
            year_repo,
        }
    }

    pub async fn execute(
        &self,
        event_id: Uuid,
        tenant_id: Uuid,
        receipt_number: &str,
        customer_name: &str,
        receipt_date: NaiveDate,
        amount: Decimal,
        is_bank: bool,
    ) -> Result<Option<JournalEntry>, DomainError> {
        if self
            .entry_repo
            .is_event_processed(tenant_id, event_id)
            .await?
        {
            return Ok(None);
        }

        let year_code = receipt_date
            .format("%Y")
            .to_string()
            .parse::<i32>()
            .unwrap_or(2026);
        let fiscal_year = match self.year_repo.find_by_year(tenant_id, year_code).await? {
            Some(y) => y,
            None => {
                let new_y = FiscalYear::new(tenant_id, year_code)?;
                self.year_repo.save(&new_y).await?;
                new_y
            }
        };

        let journal_code = if is_bank { "BC" } else { "CX" };
        let journal_type = if is_bank {
            JournalType::Bank
        } else {
            JournalType::Cash
        };
        let journal_name = if is_bank {
            "Diário de Bancos"
        } else {
            "Diário de Caixa"
        };

        let journal = match self
            .journal_repo
            .find_by_code(tenant_id, journal_code)
            .await?
        {
            Some(j) => j,
            None => {
                let new_j = Journal::new(
                    tenant_id,
                    journal_code.to_string(),
                    journal_name.to_string(),
                    journal_type,
                )?;
                self.journal_repo.save(&new_j).await?;
                new_j
            }
        };

        let period = receipt_date
            .format("%m")
            .to_string()
            .parse::<i32>()
            .unwrap_or(1);
        let next_num = self
            .journal_repo
            .next_entry_number(tenant_id, &journal.code, year_code)
            .await?;

        let entry = AccountingRulesService::create_treasury_receipt_entry(
            tenant_id,
            fiscal_year.id,
            journal.id,
            next_num,
            receipt_date,
            period,
            receipt_number,
            customer_name,
            amount,
            is_bank,
        )?;

        self.entry_repo.save(&entry).await?;
        self.entry_repo
            .mark_event_processed(
                tenant_id,
                event_id,
                "treasury.receipt.issued",
                receipt_number,
            )
            .await?;

        Ok(Some(entry))
    }
}
