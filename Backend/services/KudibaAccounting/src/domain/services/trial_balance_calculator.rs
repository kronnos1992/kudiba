use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::domain::entities::{Account, JournalEntry};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrialBalanceRow {
    pub account_code: String,
    pub account_name: String,
    pub is_analytical: bool,
    pub opening_debit: Decimal,
    pub opening_credit: Decimal,
    pub period_debit: Decimal,
    pub period_credit: Decimal,
    pub closing_debit: Decimal,
    pub closing_credit: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrialBalanceReport {
    pub rows: Vec<TrialBalanceRow>,
    pub total_opening_debit: Decimal,
    pub total_opening_credit: Decimal,
    pub total_period_debit: Decimal,
    pub total_period_credit: Decimal,
    pub total_closing_debit: Decimal,
    pub total_closing_credit: Decimal,
    pub is_balanced: bool,
}

pub struct TrialBalanceCalculator;

impl TrialBalanceCalculator {
    pub fn calculate(accounts: &[Account], entries: &[JournalEntry]) -> TrialBalanceReport {
        Self::calculate_with_opening(accounts, &[], entries)
    }

    pub fn calculate_with_opening(
        accounts: &[Account],
        opening_entries: &[JournalEntry],
        period_entries: &[JournalEntry],
    ) -> TrialBalanceReport {
        let mut account_map: BTreeMap<String, &Account> = BTreeMap::new();
        for acc in accounts {
            account_map.insert(acc.account_code.clone(), acc);
        }

        let mut opening_debits: BTreeMap<String, Decimal> = BTreeMap::new();
        let mut opening_credits: BTreeMap<String, Decimal> = BTreeMap::new();
        for entry in opening_entries {
            for line in &entry.lines {
                *opening_debits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.debit_amount;
                *opening_credits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.credit_amount;
            }
        }

        let mut period_debits: BTreeMap<String, Decimal> = BTreeMap::new();
        let mut period_credits: BTreeMap<String, Decimal> = BTreeMap::new();
        for entry in period_entries {
            for line in &entry.lines {
                *period_debits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.debit_amount;
                *period_credits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.credit_amount;
            }
        }

        let mut all_account_codes: std::collections::BTreeSet<String> =
            account_map.keys().cloned().collect();
        for code in opening_debits.keys() {
            all_account_codes.insert(code.clone());
        }
        for code in opening_credits.keys() {
            all_account_codes.insert(code.clone());
        }
        for code in period_debits.keys() {
            all_account_codes.insert(code.clone());
        }
        for code in period_credits.keys() {
            all_account_codes.insert(code.clone());
        }

        let mut rows = Vec::new();
        let mut total_o_debit = Decimal::ZERO;
        let mut total_o_credit = Decimal::ZERO;
        let mut total_p_debit = Decimal::ZERO;
        let mut total_p_credit = Decimal::ZERO;
        let mut total_c_debit = Decimal::ZERO;
        let mut total_c_credit = Decimal::ZERO;

        for code in all_account_codes {
            let o_raw_deb = opening_debits.get(&code).copied().unwrap_or(Decimal::ZERO);
            let o_raw_cred = opening_credits.get(&code).copied().unwrap_or(Decimal::ZERO);
            let p_deb = period_debits.get(&code).copied().unwrap_or(Decimal::ZERO);
            let p_cred = period_credits.get(&code).copied().unwrap_or(Decimal::ZERO);

            let (name, is_analytical) = match account_map.get(&code) {
                Some(acc) => {
                    if o_raw_deb == Decimal::ZERO
                        && o_raw_cred == Decimal::ZERO
                        && p_deb == Decimal::ZERO
                        && p_cred == Decimal::ZERO
                        && !acc.is_analytical
                    {
                        continue;
                    }
                    (acc.account_name.clone(), acc.is_analytical)
                }
                None => (format!("Conta {}", code), true),
            };

            let (o_deb, o_cred) = if o_raw_deb >= o_raw_cred {
                (o_raw_deb - o_raw_cred, Decimal::ZERO)
            } else {
                (Decimal::ZERO, o_raw_cred - o_raw_deb)
            };

            let cum_deb = o_deb + p_deb;
            let cum_cred = o_cred + p_cred;
            let (c_deb, c_cred) = if cum_deb >= cum_cred {
                (cum_deb - cum_cred, Decimal::ZERO)
            } else {
                (Decimal::ZERO, cum_cred - cum_deb)
            };

            total_o_debit += o_deb;
            total_o_credit += o_cred;
            total_p_debit += p_deb;
            total_p_credit += p_cred;
            total_c_debit += c_deb;
            total_c_credit += c_cred;

            rows.push(TrialBalanceRow {
                account_code: code,
                account_name: name,
                is_analytical,
                opening_debit: o_deb,
                opening_credit: o_cred,
                period_debit: p_deb,
                period_credit: p_cred,
                closing_debit: c_deb,
                closing_credit: c_cred,
            });
        }

        let is_balanced = total_o_debit == total_o_credit
            && total_p_debit == total_p_credit
            && total_c_debit == total_c_credit;

        TrialBalanceReport {
            rows,
            total_opening_debit: total_o_debit,
            total_opening_credit: total_o_credit,
            total_period_debit: total_p_debit,
            total_period_credit: total_p_credit,
            total_closing_debit: total_c_debit,
            total_closing_credit: total_c_credit,
            is_balanced,
        }
    }
}
