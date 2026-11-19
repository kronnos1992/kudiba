use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TenantBankAccount {
    #[serde(default, alias = "bankName")]
    pub bank_name: String,
    #[serde(default)]
    pub iban: String,
    #[serde(default, alias = "accountNumber")]
    pub account_number: Option<String>,
    #[serde(default)]
    pub swift: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default, alias = "isPrimary")]
    pub is_primary: bool,
}

impl TenantBankAccount {
    pub fn resolved_account_number(&self) -> Option<String> {
        let trimmed_acc = self
            .account_number
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        if let Some(acc) = trimmed_acc {
            return Some(acc.to_string());
        }
        let clean_iban: String = self
            .iban
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();
        if clean_iban.len() == 25 && clean_iban.starts_with("AO06") {
            let account_part = &clean_iban[12..23];
            if !account_part.is_empty() {
                return Some(account_part.to_string());
            }
        }
        None
    }

    pub fn has_required_payment_details(&self) -> bool {
        !self.bank_name.trim().is_empty()
            && !self.iban.trim().is_empty()
            && (self
                .account_number
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
                || self.resolved_account_number().is_some())
    }
}

/// Dados cadastrais e fiscais da organização / sujeito passivo (Tenant)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tenant {
    pub id: Uuid,
    pub slug: String,
    pub company_name: String,
    pub trade_name: Option<String>,
    pub nif: String,
    pub address_detail: Option<String>,
    pub city: Option<String>,
    pub province: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub logo_data_url: Option<String>,
    pub alvara_number: Option<String>,
    pub commercial_registry: Option<String>,
    pub share_capital: Option<String>,
    pub currency: Option<String>,
    pub tax_office_code: Option<String>,
    pub agt_cert_number: Option<String>,
    pub invoice_footer_notes: Option<String>,
    pub bank_accounts: Vec<TenantBankAccount>,
    pub status: String,
    pub tax_regime_code: String,
    pub contingency_started_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exige_banco_numero_de_conta_e_iban() {
        let account = TenantBankAccount {
            bank_name: "BAI".to_string(),
            account_number: Some("123456789".to_string()),
            iban: "AO06004000001234567890123".to_string(),
            ..TenantBankAccount::default()
        };
        assert!(account.has_required_payment_details());

        let missing_number = TenantBankAccount {
            account_number: None,
            iban: "NOT_AN_IBAN".to_string(),
            ..account.clone()
        };
        assert!(!missing_number.has_required_payment_details());

        let derived_from_iban = TenantBankAccount {
            bank_name: "BIC".to_string(),
            account_number: None,
            iban: "AO06.0051.0000.1757.0554.10137".to_string(),
            ..TenantBankAccount::default()
        };
        assert!(derived_from_iban.has_required_payment_details());
        assert_eq!(
            derived_from_iban.resolved_account_number().as_deref(),
            Some("17570554101")
        );

        let blank_iban = TenantBankAccount {
            iban: "  ".to_string(),
            ..account
        };
        assert!(!blank_iban.has_required_payment_details());
    }
}
