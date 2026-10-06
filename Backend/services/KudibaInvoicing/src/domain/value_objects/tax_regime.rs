use rust_decimal::Decimal;
use serde::Serialize;

use crate::domain::error::DomainError;

/// Regime de enquadramento do sujeito passivo no CIVA (Angola).
///
/// O enquadramento é determinado pelo **volume de facturação** e fixa as taxas
/// de IVA que o sujeito passivo pode aplicar nas linhas dos seus documentos.
///
/// | Regime          | Volume de facturação (Kz)     | Taxa | Crédito fiscal |
/// |-----------------|-------------------------------|------|----------------|
/// | `REGIME_EXCLUSAO`     | até 25.000.000,00         |  0%  | não            |
/// | `REGIME_SIMPLIFICADO` | > 25M e < 350M            |  7%  | não            |
/// | `REGIME_GERAL`        | a partir de 350M           | 14%  | sim            |
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum TaxRegime {
    /// Sujeito passivo desonerado das obrigações do IVA (não liquida imposto).
    Exclusion,
    /// Regime simplificado: liquida IVA a 7% sem direito à dedução do suportado.
    Simplified,
    /// Regime geral: liquida IVA a 14% e deduz o IVA suportado das compras.
    General,
}

impl TaxRegime {
    /// Tecto inferior do volume de facturação que abre o regime (Kz)
    pub fn min_turnover(self) -> Decimal {
        match self {
            TaxRegime::Exclusion => Decimal::ZERO,
            // 25.000.000,01 — a fronteira superior da exclusão é inclusiva
            TaxRegime::Simplified => Decimal::new(2_500_000_001, 2),
            TaxRegime::General => Decimal::new(35_000_000_000, 2),
        }
    }

    /// Tecto superior do volume de facturação do regime (Kz).
    ///
    /// `None` significa que o regime não tem tecto (Regime Geral).
    pub fn max_turnover(self) -> Option<Decimal> {
        match self {
            TaxRegime::Exclusion => Some(Decimal::new(2_500_000_000, 2)),
            TaxRegime::Simplified => Some(Decimal::new(34_999_999_999, 2)),
            TaxRegime::General => None,
        }
    }

    /// Taxa de IVA padrão do regime
    pub fn standard_rate(self) -> Decimal {
        match self {
            TaxRegime::Exclusion => Decimal::ZERO,
            TaxRegime::Simplified => Decimal::new(7, 0),
            TaxRegime::General => Decimal::new(14, 0),
        }
    }

    /// Taxas que o regime admite nas linhas dos documentos fiscais.
    ///
    /// A lista é sempre filtrada pelo regime do sujeito passivo, o que impede que
    /// uma empresa do Regime de Exclusão emita linhas a 14% por omissão do cliente.
    pub fn allowed_rates(self) -> Vec<Decimal> {
        match self {
            TaxRegime::Exclusion => vec![Decimal::ZERO],
            TaxRegime::Simplified => vec![Decimal::new(7, 0), Decimal::ZERO],
            TaxRegime::General => vec![
                Decimal::new(14, 0),
                Decimal::new(7, 0),
                Decimal::new(5, 0),
                Decimal::ZERO,
            ],
        }
    }

    /// Indica se o sujeito passivo liquida IVA sobre as suas operações
    pub const fn is_vat_exempt(self) -> bool {
        matches!(self, TaxRegime::Exclusion)
    }

    /// Indica se o regime abre direito à dedução do IVA suportado (crédito fiscal)
    pub const fn allows_input_vat_credit(self) -> bool {
        matches!(self, TaxRegime::General)
    }

    /// Identificador persistido na base de dados e nas SAF-T
    pub const fn code(self) -> &'static str {
        match self {
            TaxRegime::Exclusion => "REGIME_EXCLUSAO",
            TaxRegime::Simplified => "REGIME_SIMPLIFICADO",
            TaxRegime::General => "REGIME_GERAL",
        }
    }

    /// Descrição legível do regime
    pub const fn display_name(self) -> &'static str {
        match self {
            TaxRegime::Exclusion => "Regime de Exclusão",
            TaxRegime::Simplified => "Regime Simplificado",
            TaxRegime::General => "Regime Geral",
        }
    }

    /// Converte o identificador persistido num regime do domínio
    pub fn from_code(code: &str) -> Result<Self, DomainError> {
        match code.trim().to_uppercase().as_str() {
            "REGIME_EXCLUSAO" => Ok(TaxRegime::Exclusion),
            "REGIME_SIMPLIFICADO" => Ok(TaxRegime::Simplified),
            "REGIME_GERAL" => Ok(TaxRegime::General),
            other => Err(DomainError::invalid(format!(
                "Regime de IVA desconhecido: '{other}'. Esperado REGIME_EXCLUSAO, REGIME_SIMPLIFICADO ou REGIME_GERAL."
            ))),
        }
    }

    /// Resolve o regime a partir do volume de facturação anual (Kz).
    ///
    /// As frações são contíguas e não se sobrepõem: cada volume cai exactamente
    /// num regime. Um volume negativo é rejeitado por ser fisicamente impossível.
    pub fn resolve_by_turnover(annual_turnover: Decimal) -> Result<Self, DomainError> {
        if annual_turnover < Decimal::ZERO {
            return Err(DomainError::invalid(format!(
                "Volume de facturação negativo: {annual_turnover} Kz."
            )));
        }

        if let Some(max) = TaxRegime::Exclusion.max_turnover() {
            if annual_turnover <= max {
                return Ok(TaxRegime::Exclusion);
            }
        }

        if let Some(max) = TaxRegime::Simplified.max_turnover() {
            if annual_turnover <= max {
                return Ok(TaxRegime::Simplified);
            }
        }

        Ok(TaxRegime::General)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kwanza(unscaled: i64, scale: u32) -> Decimal {
        Decimal::new(unscaled, scale)
    }

    #[test]
    fn exclusao_ate_25_milhoes() {
        assert_eq!(
            TaxRegime::resolve_by_turnover(Decimal::ZERO).unwrap(),
            TaxRegime::Exclusion
        );
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(1_000_000_000, 2)).unwrap(),
            TaxRegime::Exclusion
        );
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(2_500_000_000, 2)).unwrap(),
            TaxRegime::Exclusion,
            "25.000.000,00 é o tecto inclusivo da exclusão"
        );
    }

    #[test]
    fn simplificado_acima_de_25_milhoes_e_abaixo_de_350_milhoes() {
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(2_500_000_001, 2)).unwrap(),
            TaxRegime::Simplified,
            "o cêntimo acima do tecto da exclusão já é simplificado"
        );
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(10_000_000_000, 2)).unwrap(),
            TaxRegime::Simplified
        );
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(34_999_999_999, 2)).unwrap(),
            TaxRegime::Simplified
        );
    }

    #[test]
    fn geral_a_partir_de_350_milhoes() {
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(35_000_000_000, 2)).unwrap(),
            TaxRegime::General
        );
        assert_eq!(
            TaxRegime::resolve_by_turnover(kwanza(100_000_000_000, 2)).unwrap(),
            TaxRegime::General
        );
    }

    #[test]
    fn fronteira_de_25_milhoes_nao_deixa_lacuna() {
        let abaixo = TaxRegime::resolve_by_turnover(kwanza(2_500_000_000, 2)).unwrap();
        let acima = TaxRegime::resolve_by_turnover(kwanza(2_500_000_001, 2)).unwrap();

        assert_ne!(abaixo, acima);
    }

    #[test]
    fn rejeita_volume_negativo() {
        assert!(TaxRegime::resolve_by_turnover(kwanza(-1, 0)).is_err());
    }

    #[test]
    fn taxas_padrao_por_regime() {
        assert_eq!(TaxRegime::Exclusion.standard_rate(), Decimal::ZERO);
        assert_eq!(TaxRegime::Simplified.standard_rate(), kwanza(7, 0));
        assert_eq!(TaxRegime::General.standard_rate(), kwanza(14, 0));
    }

    #[test]
    fn exclusao_nao_admite_taxa_nenhuma_para_alem_de_zero() {
        assert_eq!(TaxRegime::Exclusion.allowed_rates(), vec![Decimal::ZERO]);
    }

    #[test]
    fn regime_geral_admite_todas_as_taxas_reduzidas() {
        let rates = TaxRegime::General.allowed_rates();

        assert!(rates.contains(&kwanza(14, 0)));
        assert!(rates.contains(&kwanza(7, 0)));
        assert!(rates.contains(&kwanza(5, 0)));
        assert!(rates.contains(&Decimal::ZERO));
    }

    #[test]
    fn apenas_regime_geral_dedu_iva_suportado() {
        assert!(TaxRegime::General.allows_input_vat_credit());
        assert!(!TaxRegime::Simplified.allows_input_vat_credit());
        assert!(!TaxRegime::Exclusion.allows_input_vat_credit());
    }

    #[test]
    fn apenas_exclusao_e_desonerada() {
        assert!(TaxRegime::Exclusion.is_vat_exempt());
        assert!(!TaxRegime::Simplified.is_vat_exempt());
        assert!(!TaxRegime::General.is_vat_exempt());
    }

    #[test]
    fn conversao_de_codigo_persistente() {
        assert_eq!(
            TaxRegime::from_code("regime_geral").unwrap(),
            TaxRegime::General
        );
        assert_eq!(
            TaxRegime::from_code(" REGIME_SIMPLIFICADO ").unwrap(),
            TaxRegime::Simplified
        );
        assert_eq!(
            TaxRegime::from_code("REGIME_EXCLUSAO").unwrap(),
            TaxRegime::Exclusion
        );
        assert!(TaxRegime::from_code("REGIME_DESCONHECIDO").is_err());
    }

    #[test]
    fn codigo_e_display_name_sao_coerentes() {
        for regime in [
            TaxRegime::Exclusion,
            TaxRegime::Simplified,
            TaxRegime::General,
        ] {
            assert_eq!(TaxRegime::from_code(regime.code()).unwrap(), regime);
            assert!(!regime.display_name().is_empty());
        }
    }
}
