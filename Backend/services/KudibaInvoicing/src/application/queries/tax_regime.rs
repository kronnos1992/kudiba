use std::sync::Arc;

use rust_decimal::Decimal;

use crate::application::commands::resolve_tax_regime::to_f64_rates;
use crate::application::dto::{GetTaxRegimeQuery, GetTaxRegimeResult, TaxRegimeView};
use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};
use crate::domain::ports::tax_regime_repository::TaxRegimeRepository;
use crate::domain::value_objects::tax_regime::TaxRegime;

/// Catálogo completo dos regimes de IVA com as respetivas frações de volume
pub struct ListTaxRegimesUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    tax_regime_repository: Arc<dyn TaxRegimeRepository>,
}

impl ListTaxRegimesUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        tax_regime_repository: Arc<dyn TaxRegimeRepository>,
    ) -> Self {
        Self {
            session_factory,
            tax_regime_repository,
        }
    }

    pub async fn execute(&self) -> Result<Vec<TaxRegimeView>, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        let regimes = self
            .tax_regime_repository
            .list_regimes(session.as_mut())
            .await
            .map_err(persistence_error)?;

        // A tabela da base de dados é a fonte de verdade do catálogo; se estiver
        // vazia (base ainda não inicializada) responde com o catálogo do domínio
        if regimes.is_empty() {
            return Ok([
                TaxRegime::Exclusion,
                TaxRegime::Simplified,
                TaxRegime::General,
            ]
            .into_iter()
            .map(TaxRegimeView::from)
            .collect());
        }

        Ok(regimes.into_iter().map(TaxRegimeView::from).collect())
    }
}

/// Consulta do enquadramento fiscal vigente de um sujeito passivo
pub struct GetTaxRegimeUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    tax_regime_repository: Arc<dyn TaxRegimeRepository>,
}

impl GetTaxRegimeUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        tax_regime_repository: Arc<dyn TaxRegimeRepository>,
    ) -> Self {
        Self {
            session_factory,
            tax_regime_repository,
        }
    }

    pub async fn execute(
        &self,
        query: GetTaxRegimeQuery,
    ) -> Result<GetTaxRegimeResult, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        let tenant = self
            .tax_regime_repository
            .get_tenant_regime(session.as_mut(), query.tenant_id)
            .await
            .map_err(persistence_error)?
            .ok_or_else(|| {
                DomainError::invalid(format!(
                    "Sujeito passivo {} não existe no cadastro.",
                    query.tenant_id
                ))
            })?;

        Ok(GetTaxRegimeResult {
            tenant_id: tenant.tenant_id,
            regime_code: tenant.regime.code().to_string(),
            display_name: tenant.regime.display_name().to_string(),
            source: tenant.source.as_str().to_string(),
            basis_turnover: tenant.basis_turnover.unwrap_or(Decimal::ZERO),
            standard_rate: tenant.regime.standard_rate(),
            allowed_rates: to_f64_rates(tenant.regime),
            is_vat_exempt: tenant.regime.is_vat_exempt(),
            allows_input_vat_credit: tenant.regime.allows_input_vat_credit(),
            resolved_at: tenant.resolved_at,
            resolved_year: tenant.resolved_year,
        })
    }
}

impl From<TaxRegime> for TaxRegimeView {
    fn from(regime: TaxRegime) -> Self {
        Self {
            regime_code: regime.code().to_string(),
            display_name: regime.display_name().to_string(),
            min_turnover: regime.min_turnover(),
            max_turnover: regime.max_turnover(),
            standard_rate: regime.standard_rate(),
            allowed_rates: to_f64_rates(regime),
            requires_credit_note: regime.allows_input_vat_credit(),
            is_vat_exempt: regime.is_vat_exempt(),
            allows_input_vat_credit: regime.allows_input_vat_credit(),
        }
    }
}

/// Valida um código de isenção contra a tabela oficial da AGT
pub struct ValidateExemptionCodeUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    tax_regime_repository: Arc<dyn TaxRegimeRepository>,
}

impl ValidateExemptionCodeUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        tax_regime_repository: Arc<dyn TaxRegimeRepository>,
    ) -> Self {
        Self {
            session_factory,
            tax_regime_repository,
        }
    }

    pub async fn execute(&self, code: &str) -> Result<bool, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        self.tax_regime_repository
            .exemption_code_exists(session.as_mut(), code)
            .await
            .map_err(persistence_error)
    }
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(message) => DomainError::ConcurrencyConflict(message),
        RepositoryError::Database(message) => DomainError::Persistence(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vista_de_regime_mapeia_o_enquadramento_fiscal() {
        let view = TaxRegimeView::from(TaxRegime::General);

        assert_eq!(view.regime_code, "REGIME_GERAL");
        assert_eq!(view.standard_rate, Decimal::from(14));
        assert_eq!(view.max_turnover, None, "regime geral não tem tecto");
        assert!(view.requires_credit_note);
        assert!(view.allows_input_vat_credit);
        assert!(!view.is_vat_exempt);
    }

    #[test]
    fn regime_de_exclusao_expoe_tecto_superior() {
        let view = TaxRegimeView::from(TaxRegime::Exclusion);

        assert_eq!(view.max_turnover, Some(Decimal::new(2_500_000_000, 2)));
        assert_eq!(view.min_turnover, Decimal::ZERO);
        assert!(view.is_vat_exempt);
        assert_eq!(view.allowed_rates, vec![0.0]);
    }
}
