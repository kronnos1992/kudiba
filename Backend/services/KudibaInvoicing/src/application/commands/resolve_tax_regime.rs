use std::sync::Arc;

use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;

use crate::application::dto::{ResolveTaxRegimeCommand, ResolveTaxRegimeResult};
use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::tax_regime_repository::{
    RegimeResolution, RegimeSource, TaxRegimeRepository,
};
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::value_objects::tax_regime::TaxRegime;

/// Caso de uso de resolução automática do regime de IVA por volume de facturação.
///
/// Fluxo:
/// 1. abre a transação e lê o enquadramento vigente do sujeito passivo;
/// 2. agrega o volume líquido facturado no exercício (`net_total`, sem notas de crédito);
/// 3. resolve o regime pelas frações de volume do CIVA;
/// 4. persiste a decisão com a evidência do volume, se `persist` for verdadeiro.
///
/// O enquadramento declarado na AGT prevalece sempre sobre o automático: um
/// enquadramento manual é respeitado e o volume fica apenas registado como
/// evidência para diagnóstico.
pub struct ResolveTaxRegimeUseCase {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    tax_regime_repository: Arc<dyn TaxRegimeRepository>,
}

impl ResolveTaxRegimeUseCase {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        tax_regime_repository: Arc<dyn TaxRegimeRepository>,
    ) -> Self {
        Self {
            uow_factory,
            tax_regime_repository,
        }
    }

    pub async fn execute(
        &self,
        command: ResolveTaxRegimeCommand,
    ) -> Result<ResolveTaxRegimeResult, DomainError> {
        let mut uow = self.uow_factory.begin().await.map_err(persistence_error)?;

        match self.resolve(&mut *uow, command).await {
            Ok(result) => {
                uow.commit().await.map_err(persistence_error)?;
                tracing::info!(
                    tenant_id = %result.tenant_id,
                    regime_code = %result.regime_code,
                    annual_turnover = %result.annual_turnover,
                    regime_changed = result.regime_changed,
                    "Enquadramento fiscal de IVA resolvido por volume de facturação"
                );
                Ok(result)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!("Falha ao reverter transação fiscal: {}", rollback_err);
                }
                Err(err)
            }
        }
    }

    async fn resolve(
        &self,
        session: &mut dyn DbSession,
        command: ResolveTaxRegimeCommand,
    ) -> Result<ResolveTaxRegimeResult, DomainError> {
        let current = self
            .tax_regime_repository
            .get_tenant_regime(session, command.tenant_id)
            .await
            .map_err(persistence_error)?
            .ok_or_else(|| {
                DomainError::invalid(format!(
                    "Sujeito passivo {} não existe no cadastro.",
                    command.tenant_id
                ))
            })?;

        let annual_turnover = self
            .tax_regime_repository
            .sum_annual_turnover(session, command.tenant_id, command.fiscal_year)
            .await
            .map_err(persistence_error)?;

        let declared = command
            .declared_regime_code
            .as_deref()
            .map(str::trim)
            .filter(|code| !code.is_empty());

        let (resolved_regime, source) = match declared {
            Some(code) => (TaxRegime::from_code(code)?, RegimeSource::Declared),
            None => (
                TaxRegime::resolve_by_turnover(annual_turnover)?,
                RegimeSource::Automatic,
            ),
        };

        let resolution = RegimeResolution {
            tenant_id: command.tenant_id,
            resolved_regime,
            annual_turnover,
            fiscal_year: command.fiscal_year,
            source,
            regime_changed: current.regime != resolved_regime,
        };

        if command.persist {
            self.tax_regime_repository
                .update_tenant_regime(session, &resolution)
                .await
                .map_err(persistence_error)?;
        }

        Ok(ResolveTaxRegimeResult {
            tenant_id: command.tenant_id,
            fiscal_year: command.fiscal_year,
            regime_code: resolved_regime.code().to_string(),
            display_name: resolved_regime.display_name().to_string(),
            source: source.as_str().to_string(),
            annual_turnover,
            standard_rate: resolved_regime.standard_rate(),
            previous_regime_code: current.regime.code().to_string(),
            regime_changed: resolution.regime_changed,
            allowed_rates: to_f64_rates(resolved_regime),
            is_vat_exempt: resolved_regime.is_vat_exempt(),
            allows_input_vat_credit: resolved_regime.allows_input_vat_credit(),
            resolved_at: Utc::now(),
        })
    }
}

/// Converte as taxas `Decimal` do regime em `f64` para a resposta JSON
pub(crate) fn to_f64_rates(regime: TaxRegime) -> Vec<f64> {
    regime
        .allowed_rates()
        .iter()
        .map(|rate| rate.to_f64().unwrap_or_default())
        .collect()
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
    fn taxas_do_regime_sao_serializadas_como_numeros() {
        assert_eq!(to_f64_rates(TaxRegime::General), vec![14.0, 7.0, 5.0, 0.0]);
        assert_eq!(to_f64_rates(TaxRegime::Exclusion), vec![0.0]);
        assert_eq!(to_f64_rates(TaxRegime::Simplified), vec![7.0, 0.0]);
    }
}
