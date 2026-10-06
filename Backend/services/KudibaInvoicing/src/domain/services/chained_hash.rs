use chrono::{DateTime, NaiveDate};
use rust_decimal::{Decimal, RoundingStrategy};

use crate::domain::value_objects::canonical_buffer::CanonicalBuffer;

/// Calculadora do encadeamento de hash fiscal (Chaining) exigido pela AGT.
///
/// Regra de conformidade (Decreto Presidencial n.º 71/25):
/// `Hash_N = RSA_Sign_PrivKey( SHA256( Hash_{N-1} + DataEmissao + DocNo + TotalBruto ) )`
///
/// O primeiro documento da série (N = 1) utiliza string vazia no lugar de `Hash_{N-1}`.
pub struct ChainedHashCalculator;

impl ChainedHashCalculator {
    /// Monta o buffer canónico assinado de um documento fiscal
    pub fn build_canonical_buffer(
        previous_hash: &str,
        invoice_date: NaiveDate,
        document_number: &str,
        gross_total: Decimal,
        system_entry_date: DateTime<chrono::Utc>,
    ) -> CanonicalBuffer {
        CanonicalBuffer::build(
            invoice_date,
            system_entry_date,
            document_number,
            gross_total,
            previous_hash,
        )
    }
}

/// Motor de arredondamento monetário (2 casas decimais, `MidpointRounding.AwayFromZero`)
///
/// A aritmética é executada em decimal de 128 bits (`rust_decimal`), nunca em
/// ponto flutuante, para preservar a fidelidade dos valores fiscais.
pub struct MoneyCalculator;

impl MoneyCalculator {
    /// Arredonda para 2 casas decimais afastando-se do zero em caso de empate
    pub fn round_currency(value: Decimal) -> Decimal {
        value.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
    }

    /// Calcula a base tributável da linha: `quantidade × preço unitário`
    pub fn line_base(quantity: Decimal, unit_price: Decimal) -> Decimal {
        Self::round_currency(quantity * unit_price)
    }

    /// Calcula o imposto da linha: `base × (taxa / 100)`
    pub fn line_tax(line_base: Decimal, tax_rate: Decimal) -> Decimal {
        Self::round_currency(line_base * tax_rate / Decimal::from(100))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arredonda_afastando_do_zero() {
        // Empate na 3.a casa decimal: 10.045 -> 10.05 (como Math.Round(..., AwayFromZero) em C#)
        assert_eq!(
            MoneyCalculator::round_currency(Decimal::new(10045, 3)),
            Decimal::new(1005, 2)
        );
        // Empate negativo: -10.045 -> -10.05
        assert_eq!(
            MoneyCalculator::round_currency(Decimal::new(-10045, 3)),
            Decimal::new(-1005, 2)
        );
        // Sem empate: 10.044 -> 10.04
        assert_eq!(
            MoneyCalculator::round_currency(Decimal::new(10044, 3)),
            Decimal::new(1004, 2)
        );
        // Valor já com 2 casas: inalterado
        assert_eq!(
            MoneyCalculator::round_currency(Decimal::new(1050, 2)),
            Decimal::new(1050, 2)
        );
    }

    #[test]
    fn calcula_imposto_de_iva_normal() {
        let base = MoneyCalculator::line_base(Decimal::from(10), Decimal::from(25000));
        assert_eq!(base, Decimal::from(250000));

        let tax = MoneyCalculator::line_tax(base, Decimal::from(14));
        assert_eq!(tax, Decimal::from(35000));
    }
}
