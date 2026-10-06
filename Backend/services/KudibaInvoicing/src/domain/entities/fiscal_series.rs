use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::error::DomainError;

/// Série fiscal (`FT KUD26/000001`) — RAIZ DE AGREGAÇÃO DA CONCORRÊNCIA.
///
/// Controla o ponteiro de sequência e o hash encadeado do documento anterior.
/// O bloqueio pessimista (`SELECT ... FOR UPDATE`) é aplicado sobre este agregado
/// para garantir numeração estritamente contínua, sem lacunas nem duplicidades.
#[derive(Debug, Clone)]
pub struct FiscalSeries {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub document_type: String,
    pub series_code: String,
    pub fiscal_year: i32,
    pub current_sequence: i64,
    pub last_hash: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl FiscalSeries {
    pub fn new(
        id: Uuid,
        tenant_id: Uuid,
        document_type: &str,
        series_code: &str,
        fiscal_year: i32,
    ) -> Self {
        Self {
            id,
            tenant_id,
            document_type: document_type.to_uppercase(),
            series_code: series_code.to_uppercase(),
            fiscal_year,
            current_sequence: 0,
            last_hash: String::new(),
            is_active: true,
            created_at: Utc::now(),
        }
    }

    /// Construtor de reidratação (mapeamento a partir de uma linha persistida)
    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        id: Uuid,
        tenant_id: Uuid,
        document_type: String,
        series_code: String,
        fiscal_year: i32,
        current_sequence: i64,
        last_hash: String,
        is_active: bool,
        created_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            tenant_id,
            document_type,
            series_code,
            fiscal_year,
            current_sequence,
            last_hash,
            is_active,
            created_at,
        }
    }

    /// Próxima sequência contínua da série
    pub fn next_sequence(&self) -> i64 {
        self.current_sequence + 1
    }

    /// Avança o ponteiro da série e encadeia o hash do documento recém-emitido
    pub fn advance_sequence(&mut self, new_hash: &str) -> Result<(), DomainError> {
        if new_hash.trim().is_empty() {
            return Err(DomainError::invalid(
                "Hash cannot be empty when advancing sequence",
            ));
        }

        self.current_sequence += 1;
        self.last_hash = new_hash.to_string();
        Ok(())
    }

    /// Número legal do documento fiscal: `"{TIPO} {SÉRIE}/{SEQUÊNCIA:06}"`
    pub fn format_document_number(&self, sequence: i64) -> String {
        format!(
            "{} {}/{:06}",
            self.document_type, self.series_code, sequence
        )
    }
}
