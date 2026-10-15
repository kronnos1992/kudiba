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

pub struct CloseFiscalYearHandler {
    year_repo: Arc<dyn FiscalYearRepository>,
}

impl CloseFiscalYearHandler {
    pub fn new(year_repo: Arc<dyn FiscalYearRepository>) -> Self {
        Self { year_repo }
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

        year.close()?;
        self.year_repo.update(&year).await?;
        Ok(year)
    }
}
