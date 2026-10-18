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

