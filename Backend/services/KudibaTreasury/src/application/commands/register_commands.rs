use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{CashRegisterResponse, CreateCashRegisterRequest};
use crate::domain::entities::CashRegister;
use crate::domain::error::DomainError;
use crate::domain::ports::CashRegisterRepository;

pub struct CreateCashRegisterHandler {
    register_repo: Arc<dyn CashRegisterRepository>,
}

impl CreateCashRegisterHandler {
    pub fn new(register_repo: Arc<dyn CashRegisterRepository>) -> Self {
        Self { register_repo }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateCashRegisterRequest,
    ) -> Result<CashRegisterResponse, DomainError> {
        let trimmed_code = req.code.trim().to_uppercase();
        if self
            .register_repo
            .find_by_code(tenant_id, &trimmed_code)
            .await?
            .is_some()
        {
            return Err(DomainError::AlreadyExists(format!(
                "Já existe um caixa com o código '{}'",
                trimmed_code
            )));
        }

        let register = CashRegister::new(tenant_id, req.branch_id, trimmed_code, req.name)?;
        self.register_repo.save(&register).await?;

        Ok(register.into())
    }
}
