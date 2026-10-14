use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{BankAccountResponse, CreateBankAccountRequest};
use crate::domain::entities::BankAccount;
use crate::domain::error::DomainError;
use crate::domain::ports::BankAccountRepository;

pub struct CreateBankAccountHandler {
    bank_repo: Arc<dyn BankAccountRepository>,
}

impl CreateBankAccountHandler {
    pub fn new(bank_repo: Arc<dyn BankAccountRepository>) -> Self {
        Self { bank_repo }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateBankAccountRequest,
    ) -> Result<BankAccountResponse, DomainError> {
        let clean_iban = req.iban.trim().replace(' ', "").to_uppercase();
        if self
            .bank_repo
            .find_by_iban(tenant_id, &clean_iban)
            .await?
            .is_some()
        {
            return Err(DomainError::AlreadyExists(format!(
                "Já existe uma conta bancária registada com o IBAN '{}'",
                clean_iban
            )));
        }

        let initial_balance = req.initial_balance.unwrap_or(Decimal::ZERO);
        let account = BankAccount::new(
            tenant_id,
            req.bank_name,
            req.account_number,
            clean_iban,
            req.currency,
            initial_balance,
        )?;

        self.bank_repo.save(&account).await?;

        Ok(account.into())
    }
}
