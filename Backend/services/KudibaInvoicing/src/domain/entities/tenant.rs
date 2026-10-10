use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

/// Dados cadastrais e fiscais da organização / sujeito passivo (Tenant)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tenant {
    pub id: Uuid,
    pub slug: String,
    pub company_name: String,
    pub nif: String,
    pub address_detail: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub commercial_registry: Option<String>,
    pub tax_office_code: Option<String>,
    pub agt_cert_number: Option<String>,
    pub status: String,
    pub tax_regime_code: String,
    pub contingency_started_at: Option<DateTime<Utc>>,
}
