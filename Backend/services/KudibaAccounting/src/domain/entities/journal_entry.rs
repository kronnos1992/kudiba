use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::entities::journal_line::JournalLine;
use crate::domain::error::DomainError;
use crate::domain::value_objects::EntryStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub fiscal_year_id: Uuid,
    pub journal_id: Uuid,
    pub entry_number: i64,
    pub transaction_date: NaiveDate,
    pub system_entry_date: DateTime<Utc>,
    pub period: i32,
    pub description: String,
    pub source_service: Option<String>,
    pub source_document_type: Option<String>,
    pub source_document_id: Option<Uuid>,
    pub source_document_ref: Option<String>,
    pub total_debit: Decimal,
    pub total_credit: Decimal,
    pub status: EntryStatus,
    pub reversal_of_entry_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub lines: Vec<JournalLine>,
}

impl JournalEntry {
    pub fn new(
        tenant_id: Uuid,
        fiscal_year_id: Uuid,
        journal_id: Uuid,
        entry_number: i64,
        transaction_date: NaiveDate,
        period: i32,
        description: String,
        source_service: Option<String>,
        source_document_type: Option<String>,
        source_document_id: Option<Uuid>,
        source_document_ref: Option<String>,
        lines: Vec<JournalLine>,
        created_by: Option<Uuid>,
    ) -> Result<Self, DomainError> {
        let desc_clean = description.trim();
        if desc_clean.is_empty() {
            return Err(DomainError::ValidationError(
                "Descrição do lançamento não pode ser vazia".to_string(),
            ));
        }

        if lines.len() < 2 {
            return Err(DomainError::ValidationError(
                "Um lançamento contabilístico exige pelo menos duas linhas (partidas dobradas)"
                    .to_string(),
            ));
        }

        let mut sum_debit = Decimal::ZERO;
        let mut sum_credit = Decimal::ZERO;

        for line in &lines {
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

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            fiscal_year_id,
            journal_id,
            entry_number,
            transaction_date,
            system_entry_date: Utc::now(),
            period,
            description: desc_clean.to_string(),
            source_service,
            source_document_type,
            source_document_id,
            source_document_ref,
            total_debit: sum_debit,
            total_credit: sum_credit,
            status: EntryStatus::Posted,
            reversal_of_entry_id: None,
            created_by,
            created_at: Utc::now(),
            lines,
        })
    }

    pub fn reverse(
        &self,
        new_entry_number: i64,
        reversal_date: NaiveDate,
        period: i32,
        reason: &str,
    ) -> Result<Self, DomainError> {
        let entry_id = Uuid::new_v4();
        let mut reversed_lines = Vec::with_capacity(self.lines.len());

        for line in &self.lines {
            let mut rev_line = line.clone();
            rev_line.id = Uuid::new_v4();
            rev_line.entry_id = entry_id;
            // Inversão rigorosa: Débito passa a Crédito e vice-versa
            std::mem::swap(&mut rev_line.debit_amount, &mut rev_line.credit_amount);
            rev_line.description = Some(format!(
                "Estorno: {}",
                rev_line.description.as_deref().unwrap_or("")
            ));
            reversed_lines.push(rev_line);
        }

        Ok(Self {
            id: entry_id,
            tenant_id: self.tenant_id,
            fiscal_year_id: self.fiscal_year_id,
            journal_id: self.journal_id,
            entry_number: new_entry_number,
            transaction_date: reversal_date,
            system_entry_date: Utc::now(),
            period,
            description: format!("Estorno do Lançamento #{}: {}", self.entry_number, reason),
            source_service: self.source_service.clone(),
            source_document_type: self.source_document_type.clone(),
            source_document_id: self.source_document_id,
            source_document_ref: self.source_document_ref.clone(),
            total_debit: self.total_credit,
            total_credit: self.total_debit,
            status: EntryStatus::Reversed,
            reversal_of_entry_id: Some(self.id),
            created_by: None,
            created_at: Utc::now(),
            lines: reversed_lines,
        })
    }
}
