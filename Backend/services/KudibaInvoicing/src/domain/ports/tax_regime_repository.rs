use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::value_objects::tax_regime::TaxRegime;

/// Origem do enquadramento fiscal registado no cadastro do sujeito passivo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegimeSource {
    /// Resolvido automaticamente a partir do volume de facturação
    Automatic,
    /// Enquadramento declarado no cadastro registado junto da AGT
    Declared,
}

impl RegimeSource {
    pub const fn as_str(self) -> &'static str {
        match self {
            RegimeSource::Automatic => "AUTO",
            RegimeSource::Declared => "MANUAL",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value.trim().to_uppercase().as_str() {
            "AUTO" => RegimeSource::Automatic,
            _ => RegimeSource::Declared,
        }
    }
}

/// Enquadramento fiscal persistido de um sujeito passivo, com a fotografia do
/// volume de facturação que sustentou a última resolução automática.
#[derive(Debug, Clone)]
pub struct TenantTaxRegime {
    pub tenant_id: Uuid,
    pub regime: TaxRegime,
    pub source: RegimeSource,
    /// Volume de facturação anual (Kz) que sustentou a resolução automática
    pub basis_turnover: Option<Decimal>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_year: Option<i32>,
}

/// Resultado da comparação entre o regime vigente e o regime resolvido.
#[derive(Debug, Clone)]
pub struct RegimeResolution {
    pub tenant_id: Uuid,
    pub resolved_regime: TaxRegime,
    pub annual_turnover: Decimal,
    pub fiscal_year: i32,
    pub source: RegimeSource,
    /// `true` quando a resolução automática alterou o enquadramento
    pub regime_changed: bool,
}

/// Repositório do enquadramento fiscal de IVA dos sujeitos passivos e da
/// agregação do seu volume de facturação.
#[async_trait]
pub trait TaxRegimeRepository: Send + Sync {
    /// Lê o enquadramento fiscal vigente de um sujeito passivo
    async fn get_tenant_regime(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
    ) -> Result<Option<TenantTaxRegime>, RepositoryError>;

    /// Agrega o volume de facturação líquido do exercício fiscal.
    ///
    /// Somatório do `net_total` das faturas emitidas no ano, excluindo as notas
    /// de crédito (que reduzem o volume) para não distorcer o enquadramento.
    async fn sum_annual_turnover(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        fiscal_year: i32,
    ) -> Result<Decimal, RepositoryError>;

    /// Persiste o enquadramento fiscal resolvido, com a evidência do volume
    async fn update_tenant_regime(
        &self,
        session: &mut dyn DbSession,
        resolution: &RegimeResolution,
    ) -> Result<(), RepositoryError>;

    /// Verifica se um código de isenção existe na tabela oficial da AGT
    async fn exemption_code_exists(
        &self,
        session: &mut dyn DbSession,
        code: &str,
    ) -> Result<bool, RepositoryError>;

    /// Lista integral dos regimes de IVA (catálogo administrável)
    async fn list_regimes(
        &self,
        session: &mut dyn DbSession,
    ) -> Result<Vec<TaxRegime>, RepositoryError>;
}
