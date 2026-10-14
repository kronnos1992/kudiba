use chrono::{Datelike, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{IssueTreasuryReceiptRequest, TreasuryReceiptResponse};
use crate::domain::entities::{CashMovement, TreasuryReceipt, TreasuryReceiptLine};
use crate::domain::error::DomainError;
use crate::domain::ports::{
    BankAccountRepository, CashMovementRepository, CashSessionRepository, TreasuryReceiptRepository,
};
use crate::domain::value_objects::{MovementType, PaymentMethod, SessionStatus};

pub struct IssueTreasuryReceiptHandler {
    receipt_repo: Arc<dyn TreasuryReceiptRepository>,
    session_repo: Arc<dyn CashSessionRepository>,
    movement_repo: Arc<dyn CashMovementRepository>,
    bank_repo: Arc<dyn BankAccountRepository>,
}

impl IssueTreasuryReceiptHandler {
    pub fn new(
        receipt_repo: Arc<dyn TreasuryReceiptRepository>,
        session_repo: Arc<dyn CashSessionRepository>,
        movement_repo: Arc<dyn CashMovementRepository>,
        bank_repo: Arc<dyn BankAccountRepository>,
    ) -> Self {
        Self {
            receipt_repo,
            session_repo,
            movement_repo,
            bank_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: IssueTreasuryReceiptRequest,
    ) -> Result<TreasuryReceiptResponse, DomainError> {
        let year = Utc::now().year();
        let receipt_number = self
            .receipt_repo
            .next_receipt_number(tenant_id, year)
            .await?;

        if let Some(session_id) = req.session_id {
            let session = self
                .session_repo
                .find_by_id(tenant_id, session_id)
                .await?
                .ok_or_else(|| {
                    DomainError::NotFound(format!(
                        "Sessão de caixa '{}' não encontrada",
                        session_id
                    ))
                })?;

            if session.status != SessionStatus::Open {
                return Err(DomainError::InvalidSessionState(
                    "A sessão de caixa associada ao recibo encontra-se fechada".to_string(),
                ));
            }

            if req.payment_method == PaymentMethod::Numerario {
                let reason = format!(
                    "Recebimento de Recibo {} - Cliente: {}",
                    receipt_number, req.customer_name
                );
                let movement = CashMovement::new(
                    tenant_id,
                    session_id,
                    session.register_id,
                    MovementType::SaleReceipt,
                    req.total_amount,
                    reason,
                    session.operator_user_id.clone(),
                )?;
                self.movement_repo.save(&movement).await?;
            }
        }

        if let Some(bank_account_id) = req.bank_account_id {
            let mut bank_account = self
                .bank_repo
                .find_by_id(tenant_id, bank_account_id)
                .await?
                .ok_or_else(|| {
                    DomainError::NotFound(format!(
                        "Conta bancária '{}' não encontrada",
                        bank_account_id
                    ))
                })?;

            if !bank_account.is_active {
                return Err(DomainError::ValidationError(
                    "A conta bancária associada ao recibo encontra-se inativa".to_string(),
                ));
            }

            bank_account.credit(req.total_amount)?;
            self.bank_repo.update(&bank_account).await?;
        }

        let receipt_id = Uuid::new_v4();
        let mut lines = Vec::with_capacity(req.lines.len());
        for line_req in req.lines {
            let line = TreasuryReceiptLine::new(
                receipt_id,
                line_req.invoice_id,
                line_req.invoice_number,
                line_req.amount_settled,
                line_req.notes,
            )?;
            lines.push(line);
        }

        let mut receipt = TreasuryReceipt::new(
            tenant_id,
            receipt_number,
            req.customer_id,
            req.customer_name,
            req.customer_nif,
            req.session_id,
            req.bank_account_id,
            req.payment_method,
            req.total_amount,
            req.currency,
            req.notes,
            lines,
        )?;
        receipt.id = receipt_id;

        self.receipt_repo.save(&receipt).await?;

        Ok(receipt.into())
    }
}
