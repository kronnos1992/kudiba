//! Cálculo de Retenção na Fonte e Imposto de Selo.

use rust_decimal::Decimal;

use crate::domain::services::chained_hash::MoneyCalculator;

/// Taxa legal padrão de Retenção na Fonte para serviços em Angola: 6.5%
pub const STANDARD_SERVICE_WITHHOLDING_RATE: Decimal = Decimal::from_parts(65, 0, 0, false, 1);

/// Calculador especializado para retenção na fonte e imposto de selo
pub struct TaxAndDutyCalculator;

impl TaxAndDutyCalculator {
    /// Calcula a Retenção na Fonte (Imposto Industrial) com base na taxa e base tributável
    pub fn calculate_withholding(taxable_base: Decimal, rate: Decimal) -> Decimal {
        if taxable_base <= Decimal::ZERO || rate <= Decimal::ZERO {
            return Decimal::ZERO;
        }
        let raw = taxable_base * rate / Decimal::from(100);
        MoneyCalculator::round_currency(raw)
    }

    /// Calcula o Imposto de Selo com base na taxa e montante da operação
    pub fn calculate_stamp_duty(amount: Decimal, rate: Decimal) -> Decimal {
        if amount <= Decimal::ZERO || rate <= Decimal::ZERO {
            return Decimal::ZERO;
        }
        let raw = amount * rate / Decimal::from(100);
        MoneyCalculator::round_currency(raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calcula_retencao_de_servico_a_6_e_meio_por_cento() {
        // Exemplo: Serviço de 100.000 Kz -> 6.5% de retenção = 6.500 Kz
        let base = Decimal::from(100000);
        let withholding =
            TaxAndDutyCalculator::calculate_withholding(base, STANDARD_SERVICE_WITHHOLDING_RATE);
        assert_eq!(withholding, Decimal::from(6500));
    }

    #[test]
    fn calcula_retencao_com_arredondamento_afastando_do_zero() {
        // Base de 333.33 Kz a 6.5% = 21.66645 -> 21.67 Kz
        let base = Decimal::new(33333, 2);
        let withholding =
            TaxAndDutyCalculator::calculate_withholding(base, STANDARD_SERVICE_WITHHOLDING_RATE);
        assert_eq!(withholding, Decimal::new(2167, 2));
    }

    #[test]
    fn calcula_imposto_de_selo_com_taxa_explicita() {
        let base = Decimal::from(50000);
        let general = TaxAndDutyCalculator::calculate_stamp_duty(base, Decimal::ONE);
        assert_eq!(general, Decimal::from(500));
        let receipt = TaxAndDutyCalculator::calculate_stamp_duty(base, Decimal::new(7, 1));
        assert_eq!(receipt, Decimal::from(350));
    }

    #[test]
    fn base_ou_taxa_zerada_retorna_zero() {
        assert_eq!(
            TaxAndDutyCalculator::calculate_withholding(
                Decimal::ZERO,
                STANDARD_SERVICE_WITHHOLDING_RATE
            ),
            Decimal::ZERO
        );
        assert_eq!(
            TaxAndDutyCalculator::calculate_stamp_duty(Decimal::from(1000), Decimal::ZERO),
            Decimal::ZERO
        );
    }
}
