use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{
    CashSessionResponse, CloseCashSessionRequest, OpenCashSessionRequest,
};
use crate::domain::entities::CashSession;
use crate::domain::error::DomainError;
use crate::domain::ports::{CashMovementRepository, CashRegisterRepository, CashSessionRepository};
use crate::domain::services::ReconciliationService;

pub struct OpenCashSessionHandler {
    register_repo: Arc<dyn CashRegisterRepository>,
    session_repo: Arc<dyn CashSessionRepository>,
}

impl OpenCashSessionHandler {
    pub fn new(
        register_repo: Arc<dyn CashRegisterRepository>,
        session_repo: Arc<dyn CashSessionRepository>,
    ) -> Self {
        Self {
            register_repo,
            session_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: OpenCashSessionRequest,
    ) -> Result<CashSessionResponse, DomainError> {
        let register = self
            .register_repo
            .find_by_id(tenant_id, req.register_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Caixa com ID '{}' não encontrado", req.register_id))
            })?;

        if !register.is_active {
            return Err(DomainError::ValidationError(
                "Não é possível abrir sessão num caixa inativo".to_string(),
            ));
        }

        if let Some(open_session) = self
            .session_repo
            .find_open_session_by_register(tenant_id, req.register_id)
            .await?
        {
            return Err(DomainError::InvalidSessionState(format!(
                "O caixa '{}' já tem uma sessão aberta (ID: {})",
                register.code, open_session.id
            )));
        }

        let session = CashSession::open(
            tenant_id,
            req.register_id,
            req.operator_user_id,
            req.opening_balance,
        )?;

        self.session_repo.save(&session).await?;

        Ok(session.into())
    }
}

pub struct CloseCashSessionHandler {
    session_repo: Arc<dyn CashSessionRepository>,
    movement_repo: Arc<dyn CashMovementRepository>,
}

impl CloseCashSessionHandler {
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
        session_id: Uuid,
        req: CloseCashSessionRequest,
    ) -> Result<CashSessionResponse, DomainError> {
        let mut session = self
            .session_repo
            .find_by_id(tenant_id, session_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Sessão de caixa '{}' não encontrada", session_id))
            })?;

        let movements = self
            .movement_repo
            .list_by_session(tenant_id, session_id)
            .await?;
        let (_, _, _, _, expected_balance) =
            ReconciliationService::calculate_system_balance(session.opening_balance, &movements);

        session.close(req.closing_balance_counted, expected_balance, req.notes)?;
        self.session_repo.update(&session).await?;

        Ok(session.into())
    }
}
