use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::FiscalYearStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalYear {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub year_code: i32,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub status: FiscalYearStatus,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl FiscalYear {
    pub fn new(tenant_id: Uuid, year_code: i32) -> Result<Self, DomainError> {
        if !(2000..=2100).contains(&year_code) {
            return Err(DomainError::ValidationError(format!(
                "Ano económico '{}' fora do intervalo permitido",
                year_code
            )));
        }

        let start_date = NaiveDate::from_ymd_opt(year_code, 1, 1).ok_or_else(|| {
            DomainError::ValidationError("Data inicial do ano inválida".to_string())
        })?;
        let end_date = NaiveDate::from_ymd_opt(year_code, 12, 31).ok_or_else(|| {
            DomainError::ValidationError("Data final do ano inválida".to_string())
        })?;

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            year_code,
            start_date,
            end_date,
            status: FiscalYearStatus::Open,
            is_active: true,
            created_at: Utc::now(),
        })
    }

    pub fn close(&mut self) -> Result<(), DomainError> {
        if self.status == FiscalYearStatus::Closed {
            return Err(DomainError::InvalidFiscalYear(
                "O exercício fiscal já se encontra encerrado".to_string(),
            ));
        }
        self.status = FiscalYearStatus::Closed;
        Ok(())
    }
}
