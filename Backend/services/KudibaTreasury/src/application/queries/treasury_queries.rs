use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{
    BankAccountResponse, CashMovementResponse, CashRegisterResponse, CashSessionResponse,
    SessionReportResponse, TreasuryReceiptResponse,
};
use crate::domain::error::DomainError;
use crate::domain::ports::{
    BankAccountRepository, CashMovementRepository, CashRegisterRepository, CashSessionRepository,
    TreasuryReceiptRepository,
};
use crate::domain::services::ReconciliationService;

pub struct TreasuryQueries {
    register_repo: Arc<dyn CashRegisterRepository>,
    session_repo: Arc<dyn CashSessionRepository>,
    movement_repo: Arc<dyn CashMovementRepository>,
    bank_repo: Arc<dyn BankAccountRepository>,
    receipt_repo: Arc<dyn TreasuryReceiptRepository>,
}

impl TreasuryQueries {
    pub fn new(
        register_repo: Arc<dyn CashRegisterRepository>,
        session_repo: Arc<dyn CashSessionRepository>,
        movement_repo: Arc<dyn CashMovementRepository>,
        bank_repo: Arc<dyn BankAccountRepository>,
        receipt_repo: Arc<dyn TreasuryReceiptRepository>,
    ) -> Self {
        Self {
            register_repo,
            session_repo,
            movement_repo,
            bank_repo,
            receipt_repo,
        }
    }

    pub async fn list_cash_registers(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<CashRegisterResponse>, DomainError> {
        let registers = self.register_repo.list(tenant_id).await?;
        Ok(registers.into_iter().map(Into::into).collect())
    }

    pub async fn get_cash_register(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<CashRegisterResponse, DomainError> {
        let register = self
            .register_repo
            .find_by_id(tenant_id, id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Caixa '{}' não encontrado", id)))?;
        Ok(register.into())
    }

    pub async fn get_open_session(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
    ) -> Result<Option<CashSessionResponse>, DomainError> {
        let session = self
            .session_repo
            .find_open_session_by_register(tenant_id, register_id)
            .await?;
        Ok(session.map(Into::into))
    }

    pub async fn get_cash_session(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<CashSessionResponse, DomainError> {
        let session = self
            .session_repo
            .find_by_id(tenant_id, id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Sessão '{}' não encontrada", id)))?;
        Ok(session.into())
    }

    pub async fn get_session_report(
        &self,
        tenant_id: Uuid,
        session_id: Uuid,
    ) -> Result<SessionReportResponse, DomainError> {
        let session = self
            .session_repo
            .find_by_id(tenant_id, session_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Sessão '{}' não encontrada", session_id))
            })?;

        let register = self
            .register_repo
            .find_by_id(tenant_id, session.register_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Caixa '{}' não encontrado", session.register_id))
            })?;

        let movements = self
            .movement_repo
            .list_by_session(tenant_id, session_id)
            .await?;
        let reconciliation = ReconciliationService::reconcile(
            session.opening_balance,
            &movements,
            session.closing_balance_counted,
        );

        let movement_dtos = movements.into_iter().map(Into::into).collect();

        Ok(SessionReportResponse {
            session: session.into(),
            register_code: register.code,
            register_name: register.name,
            reconciliation,
            movements: movement_dtos,
        })
    }

    pub async fn list_session_movements(
        &self,
        tenant_id: Uuid,
        session_id: Uuid,
    ) -> Result<Vec<CashMovementResponse>, DomainError> {
        let movements = self
            .movement_repo
            .list_by_session(tenant_id, session_id)
            .await?;
        Ok(movements.into_iter().map(Into::into).collect())
    }

    pub async fn list_bank_accounts(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<BankAccountResponse>, DomainError> {
        let accounts = self.bank_repo.list(tenant_id).await?;
        Ok(accounts.into_iter().map(Into::into).collect())
    }

    pub async fn get_bank_account(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<BankAccountResponse, DomainError> {
        let account = self
            .bank_repo
            .find_by_id(tenant_id, id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Conta bancária '{}' não encontrada", id))
            })?;
        Ok(account.into())
    }

    pub async fn list_receipts(
        &self,
        tenant_id: Uuid,
        customer_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<TreasuryReceiptResponse>, DomainError> {
        let receipts = self
            .receipt_repo
            .list(tenant_id, customer_id, limit)
            .await?;
        Ok(receipts.into_iter().map(Into::into).collect())
    }

    pub async fn get_receipt(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<TreasuryReceiptResponse, DomainError> {
        let receipt = self
            .receipt_repo
            .find_by_id(tenant_id, id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Recibo '{}' não encontrado", id)))?;
        Ok(receipt.into())
    }
}
