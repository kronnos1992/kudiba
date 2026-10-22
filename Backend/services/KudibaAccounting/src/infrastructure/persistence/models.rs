use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::entities::{Account, FiscalYear, Journal, JournalEntry, JournalLine};
use crate::domain::value_objects::{
    AccountClass, AccountNature, Currency, EntryStatus, FiscalYearStatus, JournalType,
};

#[derive(Debug, FromRow)]
pub struct AccountRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub account_code: String,
    pub parent_account_code: Option<String>,
    pub account_name: String,
    pub account_class: String,
    pub account_nature: String,
    pub is_analytical: bool,
    pub is_system_reserved: bool,
    pub saft_grouping_code: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl AccountRow {
    pub fn into_domain(self) -> Account {
        let class = match self.account_class.as_str() {
            "CLASS_0_CONTAS_DE_ORDEM" => AccountClass::Class0ContasDeOrdem,
            "CLASS_1_MEIOS_FIXOS_INVESTIMENTOS" | "CLASS_1_MEIOS_FINANCEIROS" => {
                AccountClass::Class1MeiosFixosInvestimentos
            }
            "CLASS_2_EXISTENCIAS" => AccountClass::Class2Existencias,
            "CLASS_3_TERCEIROS" => AccountClass::Class3Terceiros,
            "CLASS_4_MEIOS_MONETARIOS" | "CLASS_4_IMOBILIZACOES" => {
                AccountClass::Class4MeiosMonetarios
            }
            "CLASS_5_CAPITAL_RESERVAS" | "CLASS_5_CAPITAL_PROPRIO" => {
                AccountClass::Class5CapitalReservas
            }
            "CLASS_6_PROVEITOS_POR_NATUREZA" | "CLASS_6_CUSTOS" => {
                AccountClass::Class6ProveitosPorNatureza
            }
            "CLASS_7_CUSTOS_POR_NATUREZA" | "CLASS_7_PROVEITOS" => {
                AccountClass::Class7CustosPorNatureza
            }
            _ => AccountClass::Class8Resultados,
        };

        let nature = match self.account_nature.as_str() {
            "CREDIT" => AccountNature::Credit,
            _ => AccountNature::Debit,
        };

        Account {
            id: self.id,
            tenant_id: self.tenant_id,
            account_code: self.account_code,
            parent_account_code: self.parent_account_code,
            account_name: self.account_name,
            account_class: class,
            account_nature: nature,
            is_analytical: self.is_analytical,
            is_system_reserved: self.is_system_reserved,
            saft_grouping_code: self.saft_grouping_code,
            is_active: self.is_active,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct FiscalYearRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub year_code: i32,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub status: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl FiscalYearRow {
    pub fn into_domain(self) -> FiscalYear {
        let status = match self.status.as_str() {
            "CLOSED" => FiscalYearStatus::Closed,
            "CLOSING_IN_PROGRESS" => FiscalYearStatus::ClosingInProgress,
            _ => FiscalYearStatus::Open,
        };

        FiscalYear {
            id: self.id,
            tenant_id: self.tenant_id,
            year_code: self.year_code,
            start_date: self.start_date,
            end_date: self.end_date,
            status,
            is_active: self.is_active,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct JournalRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub journal_type: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl JournalRow {
    pub fn into_domain(self) -> Journal {
        let j_type = match self.journal_type.as_str() {
            "SALES" => JournalType::Sales,
            "PURCHASES" => JournalType::Purchases,
            "CASH" => JournalType::Cash,
            "BANK" => JournalType::Bank,
            "CLOSING" => JournalType::Closing,
            _ => JournalType::Operations,
        };

        Journal {
            id: self.id,
            tenant_id: self.tenant_id,
            code: self.code,
            name: self.name,
            journal_type: j_type,
            is_active: self.is_active,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct JournalEntryRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub fiscal_year_id: Uuid,
    pub journal_id: Uuid,
    pub entry_number: i64,
    pub transaction_date: NaiveDate,
    pub system_entry_date: DateTime<Utc>,
    pub period: i32,
    pub description: String,
    pub source_service: Option<String>,
    pub source_document_type: Option<String>,
    pub source_document_id: Option<Uuid>,
    pub source_document_ref: Option<String>,
    pub total_debit: Decimal,
    pub total_credit: Decimal,
    pub status: String,
    pub reversal_of_entry_id: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl JournalEntryRow {
    pub fn into_domain(self, lines: Vec<JournalLine>) -> JournalEntry {
        let status = match self.status.as_str() {
            "DRAFT" => EntryStatus::Draft,
            "REVERSED" => EntryStatus::Reversed,
            _ => EntryStatus::Posted,
        };

        JournalEntry {
            id: self.id,
            tenant_id: self.tenant_id,
            fiscal_year_id: self.fiscal_year_id,
            journal_id: self.journal_id,
            entry_number: self.entry_number,
            transaction_date: self.transaction_date,
            system_entry_date: self.system_entry_date,
            period: self.period,
            description: self.description,
            source_service: self.source_service,
            source_document_type: self.source_document_type,
            source_document_id: self.source_document_id,
            source_document_ref: self.source_document_ref,
            total_debit: self.total_debit,
            total_credit: self.total_credit,
            status,
            reversal_of_entry_id: self.reversal_of_entry_id,
            created_by: self.created_by,
            created_at: self.created_at,
            lines,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct JournalLineRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entry_id: Uuid,
    pub line_number: i32,
    pub account_code: String,
    pub description: Option<String>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub entity_id: Option<Uuid>,
    pub cost_center_id: Option<Uuid>,
    pub currency: String,
    pub exchange_rate: Decimal,
    pub foreign_amount: Option<Decimal>,
    pub created_at: DateTime<Utc>,
}

impl JournalLineRow {
    pub fn into_domain(self) -> JournalLine {
        let currency = Currency::parse(&self.currency).unwrap_or(Currency::Aoa);

        JournalLine {
            id: self.id,
            tenant_id: self.tenant_id,
            entry_id: self.entry_id,
            line_number: self.line_number,
            account_code: self.account_code,
            description: self.description,
            debit_amount: self.debit_amount,
            credit_amount: self.credit_amount,
            entity_id: self.entity_id,
            cost_center_id: self.cost_center_id,
            currency,
            exchange_rate: self.exchange_rate,
            foreign_amount: self.foreign_amount,
            created_at: self.created_at,
        }
    }
}
