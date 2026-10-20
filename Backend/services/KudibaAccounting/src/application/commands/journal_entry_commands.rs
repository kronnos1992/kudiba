use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{
    ManualLineRequest, PostManualEntryRequest, ReverseEntryRequest, UpdateEntryRequest,
};
use crate::domain::entities::{JournalEntry, JournalLine};
use crate::domain::error::DomainError;
use crate::domain::ports::{
    AccountRepository, FiscalYearRepository, JournalEntryRepository, JournalRepository,
};
use crate::domain::value_objects::{EntryStatus, FiscalYearStatus};

async fn build_domain_lines(
    account_repo: &Arc<dyn AccountRepository>,
    tenant_id: Uuid,
    entry_id: Uuid,
    lines: Vec<ManualLineRequest>,
) -> Result<Vec<JournalLine>, DomainError> {
    let mut domain_lines = Vec::with_capacity(lines.len());

    for (idx, line_req) in lines.into_iter().enumerate() {
        let line_number = (idx + 1) as i32;

        let acc = account_repo
            .find_by_code(tenant_id, &line_req.account_code)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Conta '{}' não encontrada", line_req.account_code))
            })?;

        if !acc.is_analytical {
            return Err(DomainError::NonAnalyticalAccount(format!(
                "Conta '{}' é agregadora sintética e não aceita lançamentos",
                line_req.account_code
            )));
        }

        let debit = line_req.debit_amount.unwrap_or(Decimal::ZERO);
        let credit = line_req.credit_amount.unwrap_or(Decimal::ZERO);

        if debit > Decimal::ZERO && credit == Decimal::ZERO {
            domain_lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_number,
                line_req.account_code,
                debit,
                line_req.description,
                line_req.entity_id,
                line_req.cost_center_id,
            )?);
        } else if credit > Decimal::ZERO && debit == Decimal::ZERO {
            domain_lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_number,
                line_req.account_code,
                credit,
                line_req.description,
                line_req.entity_id,
                line_req.cost_center_id,
            )?);
        } else {
            return Err(DomainError::InvalidLine(format!(
                "Linha {} deve conter exatamente Débito ou Crédito positivo",
                line_number
            )));
        }
    }

    Ok(domain_lines)
}

pub struct PostManualEntryHandler {
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl PostManualEntryHandler {
    pub fn new(
        entry_repo: Arc<dyn JournalEntryRepository>,
        journal_repo: Arc<dyn JournalRepository>,
        year_repo: Arc<dyn FiscalYearRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            entry_repo,
            journal_repo,
            year_repo,
            account_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: PostManualEntryRequest,
        created_by: Option<Uuid>,
    ) -> Result<JournalEntry, DomainError> {
        let fiscal_year = self
            .year_repo
            .find_by_year(tenant_id, req.fiscal_year)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!(
                    "Exercício fiscal '{}' não encontrado",
                    req.fiscal_year
                ))
            })?;

        if fiscal_year.status != FiscalYearStatus::Open {
            return Err(DomainError::InvalidFiscalYear(
                "Não é permitido lançar num exercício fiscal fechado".to_string(),
            ));
        }

        let journal = self
            .journal_repo
            .find_by_code(tenant_id, &req.journal_code)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Diário '{}' não encontrado", req.journal_code))
            })?;

        let entry_id = Uuid::new_v4();
        let domain_lines =
            build_domain_lines(&self.account_repo, tenant_id, entry_id, req.lines).await?;

        let next_num = self
            .journal_repo
            .next_entry_number(tenant_id, &journal.code, req.fiscal_year)
            .await?;

        let entry = JournalEntry::new(
            tenant_id,
            fiscal_year.id,
            journal.id,
            next_num,
            req.transaction_date,
            req.period,
            req.description,
            Some("manual".to_string()),
            None,
            None,
            None,
            domain_lines,
            created_by,
        )?;

        self.entry_repo.save(&entry).await?;
        Ok(entry)
    }
}

pub struct ReverseEntryHandler {
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl ReverseEntryHandler {
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
        tenant_id: Uuid,
        req: ReverseEntryRequest,
    ) -> Result<JournalEntry, DomainError> {
        let entry = self
            .entry_repo
            .find_by_id(tenant_id, req.entry_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Lançamento '{}' não encontrado", req.entry_id))
            })?;

        let fiscal_year = self
            .year_repo
            .find_by_id(tenant_id, entry.fiscal_year_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound("Exercício fiscal do lançamento não encontrado".to_string())
            })?;

        if fiscal_year.status != FiscalYearStatus::Open {
            return Err(DomainError::InvalidFiscalYear(
                "Não é permitido estornar num exercício fiscal fechado".to_string(),
            ));
        }

        let journal = self
            .journal_repo
            .find_by_id(tenant_id, entry.journal_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound("Diário do lançamento não encontrado".to_string())
            })?;

        let next_num = self
            .journal_repo
            .next_entry_number(tenant_id, &journal.code, fiscal_year.year_code)
            .await?;

        let reversed = entry.reverse(next_num, req.reversal_date, req.period, &req.reason)?;
        self.entry_repo.save(&reversed).await?;
        Ok(reversed)
    }
}

pub struct CreateJournalHandler {
    journal_repo: Arc<dyn JournalRepository>,
}

impl CreateJournalHandler {
    pub fn new(journal_repo: Arc<dyn JournalRepository>) -> Self {
        Self { journal_repo }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: crate::application::dto::CreateJournalRequest,
    ) -> Result<crate::domain::entities::Journal, DomainError> {
        let existing = self.journal_repo.find_by_code(tenant_id, &req.code).await?;
        if existing.is_some() {
            return Err(DomainError::Conflict(format!(
                "Diário '{}' já existe para este tenant",
                req.code
            )));
        }

        let journal =
            crate::domain::entities::Journal::new(tenant_id, req.code, req.name, req.journal_type)?;

        self.journal_repo.save(&journal).await?;
        Ok(journal)
    }
}

pub struct UpdateEntryHandler {
    entry_repo: Arc<dyn JournalEntryRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl UpdateEntryHandler {
    pub fn new(
        entry_repo: Arc<dyn JournalEntryRepository>,
        year_repo: Arc<dyn FiscalYearRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            entry_repo,
            year_repo,
            account_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        entry_id: Uuid,
        req: UpdateEntryRequest,
    ) -> Result<JournalEntry, DomainError> {
        let mut entry = self
            .entry_repo
            .find_by_id(tenant_id, entry_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Lançamento '{}' não encontrado", entry_id))
            })?;

        if entry.status != EntryStatus::Posted && entry.status != EntryStatus::Draft {
            return Err(DomainError::ValidationError(
                "Lançamentos estornados não podem ser editados".to_string(),
            ));
        }

        let fiscal_year = self
            .year_repo
            .find_by_id(tenant_id, entry.fiscal_year_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound("Exercício fiscal do lançamento não encontrado".to_string())
            })?;

        if fiscal_year.status != FiscalYearStatus::Open {
            return Err(DomainError::InvalidFiscalYear(
                "Não é permitido editar lançamentos num exercício fiscal fechado".to_string(),
            ));
        }

        let desc_clean = req.description.trim();
        if desc_clean.is_empty() {
            return Err(DomainError::ValidationError(
                "Descrição do lançamento não pode ser vazia".to_string(),
            ));
        }

        let domain_lines =
            build_domain_lines(&self.account_repo, tenant_id, entry.id, req.lines).await?;

        if domain_lines.len() < 2 {
            return Err(DomainError::ValidationError(
                "Um lançamento contabilístico exige pelo menos duas linhas (partidas dobradas)"
                    .to_string(),
            ));
        }

        let mut sum_debit = Decimal::ZERO;
        let mut sum_credit = Decimal::ZERO;
        for line in &domain_lines {
            sum_debit += line.debit_amount;
            sum_credit += line.credit_amount;
        }

        if sum_debit != sum_credit {
            return Err(DomainError::UnbalancedEntry(sum_debit, sum_credit));
        }
        if sum_debit <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "Total do lançamento tem de ser superior a zero".to_string(),
            ));
        }

        entry.transaction_date = req.transaction_date;
        entry.period = req.period;
        entry.description = desc_clean.to_string();
        entry.total_debit = sum_debit;
        entry.total_credit = sum_credit;
        entry.lines = domain_lines;

        self.entry_repo.update(&entry).await?;
        Ok(entry)
    }
}
