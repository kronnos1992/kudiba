use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{
    ClosePosSessionRequest, OpenPosSessionRequest, PosSessionResponse,
};
use crate::domain::entities::PosSession;
use crate::domain::error::DomainError;
use crate::domain::ports::{CashRegisterRepository, CashSessionRepository, PosSessionRepository};

pub struct OpenPosSessionHandler {
    register_repo: Arc<dyn CashRegisterRepository>,
    pos_session_repo: Arc<dyn PosSessionRepository>,
}

impl OpenPosSessionHandler {
    pub fn new(
        register_repo: Arc<dyn CashRegisterRepository>,
        pos_session_repo: Arc<dyn PosSessionRepository>,
    ) -> Self {
        Self {
            register_repo,
            pos_session_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        opened_by: String,
        req: OpenPosSessionRequest,
    ) -> Result<PosSessionResponse, DomainError> {
        let register = self
            .register_repo
            .find_by_id(tenant_id, req.register_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Caixa com ID '{}' não encontrado", req.register_id))
            })?;

        if !register.is_active {
            return Err(DomainError::ValidationError(
                "Não é possível abrir sessão POS num caixa inativo".to_string(),
            ));
        }

        if let Some(open_session) = self
            .pos_session_repo
            .find_open_session_by_register(tenant_id, req.register_id)
            .await?
        {
            return Err(DomainError::InvalidSessionState(format!(
                "O caixa '{}' já tem uma sessão POS aberta (ID: {})",
                register.code, open_session.id
            )));
        }

        let session = PosSession::open(tenant_id, req.register_id, opened_by, req.notes)?;

        self.pos_session_repo.save(&session).await?;

        Ok(session.into())
    }
}

pub struct ClosePosSessionHandler {
    pos_session_repo: Arc<dyn PosSessionRepository>,
    session_repo: Arc<dyn CashSessionRepository>,
}

impl ClosePosSessionHandler {
    pub fn new(
        pos_session_repo: Arc<dyn PosSessionRepository>,
        session_repo: Arc<dyn CashSessionRepository>,
    ) -> Self {
        Self {
            pos_session_repo,
            session_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        pos_session_id: Uuid,
        closed_by: String,
        req: ClosePosSessionRequest,
    ) -> Result<PosSessionResponse, DomainError> {
        let mut session = self
            .pos_session_repo
            .find_by_id(tenant_id, pos_session_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!(
                    "Sessão POS '{}' não encontrada",
                    pos_session_id
                ))
            })?;

        let open_registers = self
            .session_repo
            .count_open_by_pos_session(tenant_id, pos_session_id)
            .await?;

        if open_registers > 0 {
            return Err(DomainError::InvalidSessionState(format!(
                "Não é possível fechar a sessão POS: existem {} sessões de caixa por fechar",
                open_registers
            )));
        }

        session.close(closed_by, req.notes)?;
        self.pos_session_repo.update(&session).await?;

        Ok(session.into())
    }
}
