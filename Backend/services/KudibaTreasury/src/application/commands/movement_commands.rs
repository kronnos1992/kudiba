use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{CashMovementResponse, RecordCashMovementRequest};
use crate::domain::entities::CashMovement;
use crate::domain::error::DomainError;
use crate::domain::ports::{CashMovementRepository, CashSessionRepository};
use crate::domain::services::ReconciliationService;
use crate::domain::value_objects::SessionStatus;

pub struct RecordCashMovementHandler {
    session_repo: Arc<dyn CashSessionRepository>,
    movement_repo: Arc<dyn CashMovementRepository>,
}

impl RecordCashMovementHandler {
    pub fn new(
        session_repo: Arc<dyn CashSessionRepository>,
        movement_repo: Arc<dyn CashMovementRepository>,
    ) -> Self {
        Self {
            session_repo,
            movement_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: RecordCashMovementRequest,
    ) -> Result<CashMovementResponse, DomainError> {
        let session = self
            .session_repo
            .find_by_id(tenant_id, req.session_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!(
                    "Sessão de caixa '{}' não encontrada",
                    req.session_id
                ))
            })?;

        if session.status != SessionStatus::Open {
            return Err(DomainError::InvalidSessionState(
                "Não é permitido registar movimentos numa sessão de caixa encerrada".to_string(),
            ));
        }

        if req.movement_type.is_cash_out() {
            let existing_movements = self
                .movement_repo
                .list_by_session(tenant_id, req.session_id)
                .await?;
            let (_, _, _, _, current_balance) = ReconciliationService::calculate_system_balance(
                session.opening_balance,
                &existing_movements,
            );

            if current_balance < req.amount {
                return Err(DomainError::InsufficientFunds(format!(
                    "Saldo disponível em caixa insuficiente ({}) para saída de {}",
                    current_balance, req.amount
                )));
            }
        }

        let movement = CashMovement::new(
            tenant_id,
            req.session_id,
            session.register_id,
            req.movement_type,
            req.amount,
            req.reason,
            req.operator_user_id,
        )?;

        self.movement_repo.save(&movement).await?;

        Ok(movement.into())
    }
}
