use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::value_objects::{AccountNature, Currency, JournalType};

#[derive(Debug, Clone, Deserialize)]
pub struct CreateAccountRequest {
    pub account_code: String,
    pub parent_account_code: Option<String>,
    pub account_name: String,
    pub account_nature: Option<AccountNature>,
    pub is_analytical: Option<bool>,
    pub saft_grouping_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateFiscalYearRequest {
    pub year_code: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateJournalRequest {
    pub code: String,
    pub name: String,
    pub journal_type: JournalType,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ManualLineRequest {
    pub account_code: String,
    pub description: Option<String>,
    pub debit_amount: Option<Decimal>,
    pub credit_amount: Option<Decimal>,
    pub entity_id: Option<Uuid>,
    pub cost_center_id: Option<Uuid>,
    pub currency: Option<Currency>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PostManualEntryRequest {
    pub fiscal_year: i32,
    pub journal_code: String,
    pub transaction_date: NaiveDate,
    pub period: i32,
    pub description: String,
    pub lines: Vec<ManualLineRequest>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReverseEntryRequest {
    pub entry_id: Uuid,
    pub reversal_date: NaiveDate,
    pub period: i32,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccountResponse {
    pub id: Uuid,
    pub account_code: String,
    pub parent_account_code: Option<String>,
    pub account_name: String,
    pub account_class: String,
    pub account_nature: String,
    pub is_analytical: bool,
    pub is_system_reserved: bool,
    pub saft_grouping_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JournalEntryResponse {
    pub id: Uuid,
    pub entry_number: i64,
    pub transaction_date: NaiveDate,
    pub period: i32,
    pub description: String,
    pub source_service: Option<String>,
    pub source_document_type: Option<String>,
    pub source_document_ref: Option<String>,
    pub total_debit: Decimal,
    pub total_credit: Decimal,
    pub status: String,
    pub lines: Vec<JournalLineResponse>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JournalLineResponse {
    pub id: Uuid,
    pub line_number: i32,
    pub account_code: String,
    pub description: Option<String>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub entity_id: Option<Uuid>,
}
