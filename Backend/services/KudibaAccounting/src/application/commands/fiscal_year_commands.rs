use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::CreateFiscalYearRequest;
use crate::domain::entities::FiscalYear;
use crate::domain::error::DomainError;
use crate::domain::ports::FiscalYearRepository;

pub struct OpenFiscalYearHandler {
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl OpenFiscalYearHandler {
    pub fn new(year_repo: Arc<dyn FiscalYearRepository>) -> Self {
        Self { year_repo }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateFiscalYearRequest,
    ) -> Result<FiscalYear, DomainError> {
        let existing = self
            .year_repo
            .find_by_year(tenant_id, req.year_code)
            .await?;
        if existing.is_some() {
            return Err(DomainError::Conflict(format!(
                "Exercício fiscal '{}' já existe",
                req.year_code
            )));
        }

        let year = FiscalYear::new(tenant_id, req.year_code)?;
        self.year_repo.save(&year).await?;
        Ok(year)
    }
}

use crate::domain::entities::{Journal, JournalEntry, JournalLine};
use crate::domain::ports::{JournalEntryRepository, JournalRepository};
use crate::domain::value_objects::JournalType;
use rust_decimal::Decimal;

pub struct CloseFiscalYearHandler {
    year_repo: Arc<dyn FiscalYearRepository>,
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
}

impl CloseFiscalYearHandler {
    pub fn new(
        year_repo: Arc<dyn FiscalYearRepository>,
        entry_repo: Arc<dyn JournalEntryRepository>,
        journal_repo: Arc<dyn JournalRepository>,
    ) -> Self {
        Self {
            year_repo,
            entry_repo,
            journal_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        year_code: i32,
    ) -> Result<FiscalYear, DomainError> {
        let mut year = self
            .year_repo
            .find_by_year(tenant_id, year_code)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Exercício fiscal '{}' não encontrado", year_code))
            })?;

        let closing_journal = match self.journal_repo.find_by_code(tenant_id, "FECHO").await? {
            Some(j) => j,
            None => {
                let new_j = Journal::new(
                    tenant_id,
                    "FECHO".to_string(),
                    "Diário de Apuramento e Fecho de Resultados".to_string(),
                    JournalType::Closing,
                )?;
                self.journal_repo.save(&new_j).await?;
                new_j
            }
        };

        let start_date = year.start_date;
        let end_date = year.end_date;
        let entries = self
            .entry_repo
            .list_entries(
                tenant_id,
                None,
                Some(start_date),
                Some(end_date),
                100_000,
                0,
            )
            .await?;

        let mut class6_balances: std::collections::BTreeMap<String, Decimal> =
            std::collections::BTreeMap::new();
        let mut class7_balances: std::collections::BTreeMap<String, Decimal> =
            std::collections::BTreeMap::new();

        for entry in &entries {
            if entry.period == 14 {
                continue;
            }
            for line in &entry.lines {
                if line.account_code.starts_with('6') {
                    *class6_balances
                        .entry(line.account_code.clone())
                        .or_insert(Decimal::ZERO) += line.debit_amount - line.credit_amount;
                } else if line.account_code.starts_with('7') {
                    *class7_balances
                        .entry(line.account_code.clone())
                        .or_insert(Decimal::ZERO) += line.credit_amount - line.debit_amount;
                }
            }
        }

        let mut lines = Vec::new();
        let mut line_num = 1;
        let entry_id = Uuid::new_v4();

        let mut total_operational_costs = Decimal::ZERO;
        let mut total_financial_costs = Decimal::ZERO;
        let mut total_operational_rev = Decimal::ZERO;
        let mut total_financial_rev = Decimal::ZERO;

        for (code, net_cost) in &class6_balances {
            if *net_cost > Decimal::ZERO {
                if code.starts_with("66") {
                    total_financial_costs += *net_cost;
                } else {
                    total_operational_costs += *net_cost;
                }
                lines.push(JournalLine::new_credit(
                    tenant_id,
                    entry_id,
                    line_num,
                    code.clone(),
                    *net_cost,
                    Some(format!(
                        "Zeração de custos no fecho do exercício {}",
                        year_code
                    )),
                    None,
                    None,
                )?);
                line_num += 1;
            }
        }

        if total_operational_costs > Decimal::ZERO {
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_num,
                "81".to_string(),
                total_operational_costs,
                Some("Transferência de custos operacionais para apuramento".to_string()),
                None,
                None,
            )?);
            line_num += 1;
        }

        if total_financial_costs > Decimal::ZERO {
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_num,
                "82".to_string(),
                total_financial_costs,
                Some("Transferência de custos financeiros para apuramento".to_string()),
                None,
                None,
            )?);
            line_num += 1;
        }

        for (code, net_rev) in &class7_balances {
            if *net_rev > Decimal::ZERO {
                if code.starts_with("75") {
                    total_financial_rev += *net_rev;
                } else {
                    total_operational_rev += *net_rev;
                }
                lines.push(JournalLine::new_debit(
                    tenant_id,
                    entry_id,
                    line_num,
                    code.clone(),
                    *net_rev,
                    Some(format!(
                        "Zeração de proveitos no fecho do exercício {}",
                        year_code
                    )),
                    None,
                    None,
                )?);
                line_num += 1;
            }
        }

        if total_operational_rev > Decimal::ZERO {
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_num,
                "81".to_string(),
                total_operational_rev,
                Some("Transferência de proveitos operacionais para apuramento".to_string()),
                None,
                None,
            )?);
            line_num += 1;
        }

        if total_financial_rev > Decimal::ZERO {
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_num,
                "82".to_string(),
                total_financial_rev,
                Some("Transferência de proveitos financeiros para apuramento".to_string()),
                None,
                None,
            )?);
            line_num += 1;
        }

        let net_operational = total_operational_rev - total_operational_costs;
        if net_operational > Decimal::ZERO {
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_num,
                "81".to_string(),
                net_operational,
                Some("Transferência do lucro operacional para resultado líquido".to_string()),
                None,
                None,
            )?);
            line_num += 1;
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_num,
                "88".to_string(),
                net_operational,
                Some("Lucro operacional do exercício".to_string()),
                None,
                None,
            )?);
            line_num += 1;
        } else if net_operational < Decimal::ZERO {
            let loss = net_operational.abs();
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_num,
                "81".to_string(),
                loss,
                Some("Transferência do prejuízo operacional para resultado líquido".to_string()),
                None,
                None,
            )?);
            line_num += 1;
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_num,
                "88".to_string(),
                loss,
                Some("Prejuízo operacional do exercício".to_string()),
                None,
                None,
            )?);
            line_num += 1;
        }

        let net_financial = total_financial_rev - total_financial_costs;
        if net_financial > Decimal::ZERO {
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_num,
                "82".to_string(),
                net_financial,
                Some("Transferência do ganho financeiro para resultado líquido".to_string()),
                None,
                None,
            )?);
            line_num += 1;
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_num,
                "88".to_string(),
                net_financial,
                Some("Ganho financeiro do exercício".to_string()),
                None,
                None,
            )?);
        } else if net_financial < Decimal::ZERO {
            let fin_loss = net_financial.abs();
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_num,
                "82".to_string(),
                fin_loss,
                Some("Transferência da perda financeira para resultado líquido".to_string()),
                None,
                None,
            )?);
            line_num += 1;
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_num,
                "88".to_string(),
                fin_loss,
                Some("Perda financeira do exercício".to_string()),
                None,
                None,
            )?);
        }

        if lines.len() >= 2 {
            let next_num = self
                .journal_repo
                .next_entry_number(tenant_id, &closing_journal.code, year_code)
                .await?;

            let closing_entry = JournalEntry::new(
                tenant_id,
                year.id,
                closing_journal.id,
                next_num,
                end_date,
                14,
                format!(
                    "Apuramento e Encerramento de Resultados do Exercício {}",
                    year_code
                ),
                Some("accounting-close".to_string()),
                Some("CLOSING".to_string()),
                None,
                Some(format!("FECHO-{}", year_code)),
                lines,
                None,
            )?;

            self.entry_repo.save(&closing_entry).await?;
        }

        year.close()?;
        self.year_repo.update(&year).await?;
        Ok(year)
    }
}
