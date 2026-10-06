use rust_decimal::Decimal;

use crate::domain::error::DomainError;
use crate::domain::value_objects::tax_regime::TaxRegime;

/// Validador das taxas de IVA e dos códigos de isenção aplicados às linhas.
///
/// Verifica três invariantes do art.º 12.º do CIVA e do Decreto Presidencial
/// n.º 71/25 (AGT Angola):
///
/// 1. a taxa pertence ao conjunto `allowed_rates` do regime do sujeito passivo;
/// 2. uma linha isenta (`0.00`) tem de ostentar um código de isenção `M00`–`M99`;
/// 3. uma tributada não pode ostentar código de isenção (contraditório na SAF-T).
pub struct TaxRateValidator;

impl TaxRateValidator {
    /// Valida a taxa de uma linha contra o regime do sujeito passivo
    pub fn validate_rate(
        regime: TaxRegime,
        tax_rate: Decimal,
        tax_exemption_code: Option<&str>,
    ) -> Result<(), DomainError> {
        if tax_rate < Decimal::ZERO {
            return Err(DomainError::invalid(format!(
                "Taxa de IVA negativa ({tax_rate}) na linha de artigo."
            )));
        }

        if tax_rate.scale() > 2 {
            return Err(DomainError::invalid(format!(
                "Taxa de IVA com precisão superior a 2 casas decimais: {tax_rate}."
            )));
        }

        let allowed = regime.allowed_rates();
        if !allowed.contains(&tax_rate) {
            return Err(DomainError::invalid(format!(
                "Taxa de IVA {tax_rate} não é admissível no {}. Taxas permitidas: {}. \
                 Enquadramento por volume de facturação: 0,00 a 25.000.000,00 -> Exclusão; \
                 25.000.000,01 a 349.999.999,99 -> Simplificado; \
                 a partir de 350.000.000,00 -> Geral.",
                regime.display_name(),
                format_rates(&allowed),
            )));
        }

        Self::validate_exemption_code(tax_rate, tax_exemption_code)
    }

    /// Valida a coerência entre a taxa nula e o código de isenção declarado
    fn validate_exemption_code(
        tax_rate: Decimal,
        tax_exemption_code: Option<&str>,
    ) -> Result<(), DomainError> {
        let code = tax_exemption_code.map(str::trim).filter(|c| !c.is_empty());

        if tax_rate.is_zero() {
            let Some(code) = code else {
                return Err(DomainError::invalid(
                    "Linha iserta de IVA (taxa 0.00) exige o código de isenção \
                     oficial da AGT (M00 a M99).",
                ));
            };

            if !is_valid_exemption_code_format(code) {
                return Err(DomainError::invalid(format!(
                    "Código de isenção inválido: '{code}'. Formato obrigatório: 'M' seguido de \
                     dois dígitos (ex.: 'M02', 'M04')."
                )));
            }

            return Ok(());
        }

        if code.is_some() {
            return Err(DomainError::invalid(format!(
                "Linha tributada a {tax_rate} não pode ostentar código de isenção '{}'. \
                 O código só é admissível quando a taxa é 0.00.",
                code.unwrap_or_default()
            )));
        }

        Ok(())
    }

    /// Valida o conjunto inteiro de linhas de um documento fiscal
    ///
    /// A validação por agregado impede que uma fatura parcialmente inválida seja
    /// emitida: ou todas as linhas respeitam o regime, ou nenhuma é aceite.
    pub fn validate_lines<'a>(
        regime: TaxRegime,
        lines: impl Iterator<Item = (i32, Decimal, Option<&'a str>)>,
    ) -> Result<(), DomainError> {
        for (line_number, tax_rate, exemption_code) in lines {
            if let Err(err) = Self::validate_rate(regime, tax_rate, exemption_code) {
                return Err(DomainError::invalid(format!("Linha {line_number}: {err}")));
            }
        }

        Ok(())
    }
}

/// Formato oficial dos códigos de isenção da AGT: `M` seguido de dois dígitos
pub fn is_valid_exemption_code_format(code: &str) -> bool {
    let code = code.trim();

    code.len() == 3
        && code.starts_with('M')
        && code[1..]
            .chars()
            .all(|character| character.is_ascii_digit())
}

fn format_rates(rates: &[Decimal]) -> String {
    rates
        .iter()
        .map(|rate| format!("{rate}%"))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXCLUSAO: TaxRegime = TaxRegime::Exclusion;
    const SIMPLIFICADO: TaxRegime = TaxRegime::Simplified;
    const GERAL: TaxRegime = TaxRegime::General;

    #[test]
    fn rejeita_taxa_fora_do_regime() {
        let err = TaxRateValidator::validate_rate(EXCLUSAO, Decimal::from(14), None).unwrap_err();

        assert!(
            err.to_string().contains("não é admissível"),
            "mensagem deve explicar a recusa: {err}"
        );
    }

    #[test]
    fn exclusao_rejeita_qualquer_taxa_positiva() {
        for rate in [7, 14, 5] {
            assert!(
                TaxRateValidator::validate_rate(EXCLUSAO, Decimal::from(rate), None).is_err(),
                "exclusão não pode liquidar {rate}%"
            );
        }
    }

    #[test]
    fn simplificado_aceita_7_e_rejeita_14() {
        assert!(TaxRateValidator::validate_rate(SIMPLIFICADO, Decimal::from(7), None).is_ok());
        assert!(TaxRateValidator::validate_rate(SIMPLIFICADO, Decimal::from(14), None).is_err());
    }

    #[test]
    fn regime_geral_aceita_todas_as_taxas_reduzidas() {
        for rate in [14, 7, 5] {
            assert!(
                TaxRateValidator::validate_rate(GERAL, Decimal::from(rate), None).is_ok(),
                "regime geral deve aceitar {rate}%"
            );
        }
    }

    #[test]
    fn taxa_zero_exige_codigo_de_isencao() {
        assert!(TaxRateValidator::validate_rate(GERAL, Decimal::ZERO, None).is_err());
        assert!(TaxRateValidator::validate_rate(GERAL, Decimal::ZERO, Some("")).is_err());
        assert!(TaxRateValidator::validate_rate(GERAL, Decimal::ZERO, Some("M02")).is_ok());
    }

    #[test]
    fn taxa_nula_e_aceita_no_regime_de_exclusao_com_codigo() {
        assert!(TaxRateValidator::validate_rate(EXCLUSAO, Decimal::ZERO, Some("M00")).is_ok());
    }

    #[test]
    fn taxa_tributada_proibe_codigo_de_isencao() {
        let err =
            TaxRateValidator::validate_rate(GERAL, Decimal::from(14), Some("M02")).unwrap_err();

        assert!(
            err.to_string().contains("não pode ostentar código"),
            "código de isenção em linha tributada é contraditório: {err}"
        );
    }

    #[test]
    fn codigo_de_isencao_mal_formado_e_rejeitado() {
        for code in ["X02", "M2", "M002", "MAB", "02"] {
            assert!(
                TaxRateValidator::validate_rate(GERAL, Decimal::ZERO, Some(code)).is_err(),
                "'{code}' não é um código de isenção válido"
            );
        }
    }

    #[test]
    fn taxa_negativa_e_rejeitada() {
        assert!(TaxRateValidator::validate_rate(GERAL, Decimal::from(-1), None).is_err());
    }

    #[test]
    fn taxa_com_precisao_excessiva_e_rejeitada() {
        assert!(TaxRateValidator::validate_rate(GERAL, Decimal::new(145, 1), None).is_err());
    }

    #[test]
    fn valida_conjunto_de_linhas_com_numero_da_linha() {
        let lines = vec![
            (1, Decimal::from(14), None),
            (2, Decimal::ZERO, Some("M04")),
            (3, Decimal::from(99), None),
        ];

        let err = TaxRateValidator::validate_lines(GERAL, lines.into_iter()).unwrap_err();

        assert!(
            err.to_string().starts_with("Linha 3:"),
            "o erro tem de identificar a linha culpada: {err}"
        );
    }

    #[test]
    fn conjunto_inteiramente_valido_e_aceite() {
        let lines = vec![(1, Decimal::from(14), None), (2, Decimal::from(7), None)];

        assert!(TaxRateValidator::validate_lines(GERAL, lines.into_iter()).is_ok());
    }

    #[test]
    fn valida_formato_de_codigo_de_isencao() {
        assert!(is_valid_exemption_code_format("M00"));
        assert!(is_valid_exemption_code_format("M99"));
        assert!(is_valid_exemption_code_format(" M02 "));
        assert!(!is_valid_exemption_code_format("M100"));
        assert!(!is_valid_exemption_code_format("m00"));
    }
}
