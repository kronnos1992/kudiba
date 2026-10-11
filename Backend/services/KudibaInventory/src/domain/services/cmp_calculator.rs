use rust_decimal::{Decimal, RoundingStrategy};

use crate::domain::error::InventoryError;

pub struct CmpCalculator;

impl CmpCalculator {
    pub fn calculate_new_cmp(
        current_quantity: Decimal,
        current_cmp: Decimal,
        incoming_quantity: Decimal,
        incoming_unit_cost: Decimal,
    ) -> Result<Decimal, InventoryError> {
        if incoming_quantity <= Decimal::ZERO {
            return Err(InventoryError::InvalidQuantity(
                "Quantidade de entrada para cálculo de CMP deve ser maior que zero".to_string(),
            ));
        }

        if incoming_unit_cost < Decimal::ZERO {
            return Err(InventoryError::InvalidPrice(
                "Custo unitário de entrada não pode ser negativo".to_string(),
            ));
        }

        // Se o stock atual for zero ou negativo (ex.: saldo inicial ou acerto), o novo CMP é o custo de entrada
        if current_quantity <= Decimal::ZERO {
            return Ok(incoming_unit_cost
                .round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero));
        }

        let current_total_value = current_quantity * current_cmp;
        let incoming_total_value = incoming_quantity * incoming_unit_cost;
        let new_total_quantity = current_quantity + incoming_quantity;

        let raw_cmp = (current_total_value + incoming_total_value) / new_total_quantity;
        Ok(raw_cmp.round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn calcula_cmp_inicial_quando_stock_zero() {
        let cmp =
            CmpCalculator::calculate_new_cmp(dec!(0), dec!(0), dec!(10), dec!(500.00)).unwrap();
        assert_eq!(cmp, dec!(500.0000));
    }

    #[test]
    fn calcula_cmp_ponderado_em_segunda_compra() {
        // 10 unidades a 100 AOA = 1000 AOA
        // Entrada de 10 unidades a 200 AOA = 2000 AOA
        // Total: 20 unidades por 3000 AOA => CMP = 150 AOA
        let cmp =
            CmpCalculator::calculate_new_cmp(dec!(10), dec!(100), dec!(10), dec!(200)).unwrap();
        assert_eq!(cmp, dec!(150.0000));
    }

    #[test]
    fn calcula_cmp_com_quantidades_desiguais_e_casas_decimais() {
        // 15 unidades a 125.50 AOA = 1882.50 AOA
        // Entrada de 5 unidades a 180.00 AOA = 900.00 AOA
        // Total: 20 unidades por 2782.50 AOA => CMP = 139.1250 AOA
        let cmp = CmpCalculator::calculate_new_cmp(dec!(15), dec!(125.50), dec!(5), dec!(180.00))
            .unwrap();
        assert_eq!(cmp, dec!(139.1250));
    }

    #[test]
    fn rejeita_quantidade_de_entrada_zero_ou_negativa() {
        let res = CmpCalculator::calculate_new_cmp(dec!(10), dec!(100), dec!(0), dec!(200));
        assert!(res.is_err());
    }
}
