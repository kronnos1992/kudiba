use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{CurrencyRevaluationRequest, CurrencyRevaluationResponse};
use crate::domain::entities::{Journal, JournalEntry, JournalLine};
use crate::domain::error::DomainError;
use crate::domain::ports::{
    AccountRepository, FiscalYearRepository, JournalEntryRepository, JournalRepository,
};
use crate::domain::value_objects::{FiscalYearStatus, JournalType};

pub struct RevalueCurrencyBalancesHandler {
    account_repo: Arc<dyn AccountRepository>,
    entry_repo: Arc<dyn JournalEntryRepository>,
    journal_repo: Arc<dyn JournalRepository>,
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl RevalueCurrencyBalancesHandler {
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

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CurrencyRevaluationRequest,
        operator_user_id: Option<Uuid>,
    ) -> Result<CurrencyRevaluationResponse, DomainError> {
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
                "Não é permitido efetuar revalorização cambial num exercício fechado".to_string(),
            ));
        }

        if req.period < 1 || req.period > 14 {
            return Err(DomainError::ValidationError(
                "O período contabilístico deve situar-se entre 1 e 14".to_string(),
            ));
        }

        if req.foreign_balance <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O saldo em moeda estrangeira deve ser estritamente positivo".to_string(),
            ));
        }

        if req.new_exchange_rate <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "A taxa de câmbio de fecho deve ser estritamente positiva".to_string(),
            ));
        }

        let target_acc = self
            .account_repo
            .find_by_code(tenant_id, &req.target_account_code)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!(
                    "Conta '{}' não encontrada",
                    req.target_account_code
                ))
            })?;

        if !target_acc.is_analytical {
            return Err(DomainError::NonAnalyticalAccount(format!(
                "Conta '{}' é agregadora sintética e não aceita lançamentos",
                req.target_account_code
            )));
        }

        let new_book_value_kz = (req.foreign_balance * req.new_exchange_rate).round_dp(2);
        let diff = new_book_value_kz - req.previous_book_value_kz;

        if diff == Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "Variação cambial nula: o valor contabilístico atual coincide com o novo valor recalculado".to_string(),
            ));
        }

        let is_gain = diff > Decimal::ZERO;
        let diff_abs = diff.abs();
        let offset_account_code = if is_gain {
            "66.2".to_string() // Decreto 82/01: Proveitos Financeiros - Diferenças de Câmbio Favoráveis
        } else {
            "76.2".to_string() // Decreto 82/01: Custos Financeiros - Diferenças de Câmbio Desfavoráveis
        };

        // Assegurar existência da conta de contrapartida (66.2 ou 76.2)
        let _ = self
            .account_repo
            .find_by_code(tenant_id, &offset_account_code)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!(
                    "Conta de resultados cambiais '{}' não configurada no plano de contas",
                    offset_account_code
                ))
            })?;

        let journal = match self.journal_repo.find_by_code(tenant_id, "DIV").await? {
            Some(j) => j,
            None => match self.journal_repo.find_by_code(tenant_id, "OP").await? {
                Some(j) => j,
                None => {
                    let j = Journal::new(
                        tenant_id,
                        "DIV".to_string(),
                        "Diário de Operações Diversas".to_string(),
                        JournalType::Operations,
                    )?;
                    self.journal_repo.save(&j).await?;
                    j
                }
            },
        };

        let entry_id = Uuid::new_v4();
        let entry_number = self
            .journal_repo
            .next_entry_number(tenant_id, &journal.code, req.fiscal_year)
            .await?;

        let description = format!(
            "Revalorização Cambial {} ({}) à taxa {}",
            req.target_account_code, req.currency, req.new_exchange_rate
        );

        let lines = if is_gain {
            vec![
                JournalLine::new_debit(
                    tenant_id,
                    entry_id,
                    1,
                    req.target_account_code.clone(),
                    diff_abs,
                    Some(description.clone()),
                    None,
                    None,
                )?,
                JournalLine::new_credit(
                    tenant_id,
                    entry_id,
                    2,
                    offset_account_code.clone(),
                    diff_abs,
                    Some(
                        "Ganhos em Moeda Estrangeira (Diferenças de Câmbio Favoráveis)".to_string(),
                    ),
                    None,
                    None,
                )?,
            ]
        } else {
            vec![
                JournalLine::new_debit(
                    tenant_id,
                    entry_id,
                    1,
                    offset_account_code.clone(),
                    diff_abs,
                    Some(
                        "Prejuízos em Moeda Estrangeira (Diferenças de Câmbio Desfavoráveis)"
                            .to_string(),
                    ),
                    None,
                    None,
                )?,
                JournalLine::new_credit(
                    tenant_id,
                    entry_id,
                    2,
                    req.target_account_code.clone(),
                    diff_abs,
                    Some(description.clone()),
                    None,
                    None,
                )?,
            ]
        };

        let entry = JournalEntry::new(
            tenant_id,
            fiscal_year.id,
            journal.id,
            entry_number,
            req.revaluation_date,
            req.period,
            description,
            Some("kudiba-accounting".to_string()),
            Some("FX_REVALUATION".to_string()),
            None,
            Some(format!("FX-{}-{}", req.currency, req.target_account_code)),
            lines,
            operator_user_id,
        )?;

        self.entry_repo.save(&entry).await?;

        Ok(CurrencyRevaluationResponse {
            entry_id: entry.id,
            entry_number: entry.entry_number,
            target_account_code: req.target_account_code,
            currency: req.currency.to_string(),
            exchange_difference: diff,
            is_gain,
            offset_account_code,
            new_book_value_kz,
        })
    }
}
