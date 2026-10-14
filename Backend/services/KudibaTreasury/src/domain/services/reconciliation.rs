use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::domain::entities::CashMovement;
use crate::domain::value_objects::MovementType;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiscrepancyType {
    Exact,
    Surplus,
    Shortage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionReconciliation {
    pub opening_balance: Decimal,
    pub total_supply: Decimal,
    pub total_sale_receipt: Decimal,
    pub total_bleed: Decimal,
    pub total_expense: Decimal,
    pub total_in: Decimal,
    pub total_out: Decimal,
    pub expected_balance: Decimal,
    pub counted_balance: Option<Decimal>,
    pub discrepancy: Option<Decimal>,
    pub discrepancy_type: Option<DiscrepancyType>,
}

pub struct ReconciliationService;

impl ReconciliationService {
    pub fn calculate_system_balance(
        opening_balance: Decimal,
        movements: &[CashMovement],
    ) -> (Decimal, Decimal, Decimal, Decimal, Decimal) {
        let mut total_supply = Decimal::ZERO;
        let mut total_sale_receipt = Decimal::ZERO;
        let mut total_bleed = Decimal::ZERO;
        let mut total_expense = Decimal::ZERO;

        for m in movements {
            match m.movement_type {
                MovementType::Supply => total_supply += m.amount,
                MovementType::SaleReceipt => total_sale_receipt += m.amount,
                MovementType::Bleed => total_bleed += m.amount,
                MovementType::Expense => total_expense += m.amount,
            }
        }

        let total_in = total_supply + total_sale_receipt;
        let total_out = total_bleed + total_expense;
        let expected = opening_balance + total_in - total_out;

        (
            total_supply,
            total_sale_receipt,
            total_bleed,
            total_expense,
            expected,
        )
    }

    pub fn reconcile(
        opening_balance: Decimal,
        movements: &[CashMovement],
        counted_balance: Option<Decimal>,
    ) -> SessionReconciliation {
        let (total_supply, total_sale_receipt, total_bleed, total_expense, expected_balance) =
            Self::calculate_system_balance(opening_balance, movements);

        let total_in = total_supply + total_sale_receipt;
        let total_out = total_bleed + total_expense;

        let (discrepancy, discrepancy_type) = if let Some(counted) = counted_balance {
            let diff = counted - expected_balance;
            let disc_type = if diff > Decimal::ZERO {
                DiscrepancyType::Surplus
            } else if diff < Decimal::ZERO {
                DiscrepancyType::Shortage
            } else {
                DiscrepancyType::Exact
            };
            (Some(diff), Some(disc_type))
        } else {
            (None, None)
        };

        SessionReconciliation {
            opening_balance,
            total_supply,
            total_sale_receipt,
            total_bleed,
            total_expense,
            total_in,
            total_out,
            expected_balance,
            counted_balance,
            discrepancy,
            discrepancy_type,
        }
    }
}
