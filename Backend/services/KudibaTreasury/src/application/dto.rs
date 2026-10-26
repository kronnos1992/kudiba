use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::entities::{
    BankAccount, CashMovement, CashRegister, CashSession, InvoiceReceivable, PosSession,
    ReceivableStatus, TreasuryReceipt, TreasuryReceiptLine,
};
use crate::domain::services::SessionReconciliation;
use crate::domain::value_objects::{Currency, MovementType, PaymentMethod, SessionStatus};

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCashRegisterRequest {
    pub branch_id: Option<Uuid>,
    pub code: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CashRegisterResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub branch_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CashRegister> for CashRegisterResponse {
    fn from(r: CashRegister) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            branch_id: r.branch_id,
            code: r.code,
            name: r.name,
            is_active: r.is_active,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenPosSessionRequest {
    pub register_id: Uuid,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClosePosSessionRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PosSessionResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub register_id: Uuid,
    pub opened_by: String,
    pub opened_at: DateTime<Utc>,
    pub closed_by: Option<String>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closing_notes: Option<String>,
    pub status: SessionStatus,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<PosSession> for PosSessionResponse {
    fn from(s: PosSession) -> Self {
        Self {
            id: s.id,
            tenant_id: s.tenant_id,
            register_id: s.register_id,
            opened_by: s.opened_by,
            opened_at: s.opened_at,
            closed_by: s.closed_by,
            closed_at: s.closed_at,
            closing_notes: s.closing_notes,
            status: s.status,
            notes: s.notes,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenCashSessionRequest {
    pub register_id: Uuid,
    pub operator_user_id: String,
    pub opening_balance: Decimal,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CloseCashSessionRequest {
    pub closing_balance_counted: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CashSessionResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub register_id: Uuid,
    pub pos_session_id: Option<Uuid>,
    pub operator_user_id: String,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub opening_balance: Decimal,
    pub closing_balance_counted: Option<Decimal>,
    pub closing_balance_system: Option<Decimal>,
    pub discrepancy: Option<Decimal>,
    pub status: SessionStatus,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CashSession> for CashSessionResponse {
    fn from(s: CashSession) -> Self {
        Self {
            id: s.id,
            tenant_id: s.tenant_id,
            register_id: s.register_id,
            pos_session_id: s.pos_session_id,
            operator_user_id: s.operator_user_id,
            opened_at: s.opened_at,
            closed_at: s.closed_at,
            opening_balance: s.opening_balance,
            closing_balance_counted: s.closing_balance_counted,
            closing_balance_system: s.closing_balance_system,
            discrepancy: s.discrepancy,
            status: s.status,
            notes: s.notes,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecordCashMovementRequest {
    pub session_id: Uuid,
    pub movement_type: MovementType,
    pub amount: Decimal,
    pub reason: String,
    pub operator_user_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CashMovementResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub session_id: Uuid,
    pub register_id: Uuid,
    pub movement_type: MovementType,
    pub amount: Decimal,
    pub reason: String,
    pub operator_user_id: String,
    pub created_at: DateTime<Utc>,
}

impl From<CashMovement> for CashMovementResponse {
    fn from(m: CashMovement) -> Self {
        Self {
            id: m.id,
            tenant_id: m.tenant_id,
            session_id: m.session_id,
            register_id: m.register_id,
            movement_type: m.movement_type,
            amount: m.amount,
            reason: m.reason,
            operator_user_id: m.operator_user_id,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionReportResponse {
    pub session: CashSessionResponse,
    pub register_code: String,
    pub register_name: String,
    pub reconciliation: SessionReconciliation,
    pub movements: Vec<CashMovementResponse>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBankAccountRequest {
    pub bank_name: String,
    pub account_number: String,
    pub iban: String,
    pub currency: Currency,
    pub initial_balance: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BankAccountResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub bank_name: String,
    pub account_number: String,
    pub iban: String,
    pub currency: Currency,
    pub current_balance: Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<BankAccount> for BankAccountResponse {
    fn from(b: BankAccount) -> Self {
        Self {
            id: b.id,
            tenant_id: b.tenant_id,
            bank_name: b.bank_name,
            account_number: b.account_number,
            iban: b.iban,
            currency: b.currency,
            current_balance: b.current_balance,
            is_active: b.is_active,
            created_at: b.created_at,
            updated_at: b.updated_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReceiptLineRequest {
    pub invoice_id: String,
    pub invoice_number: String,
    pub amount_settled: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct IssueTreasuryReceiptRequest {
    pub customer_id: String,
    pub customer_name: String,
    pub customer_nif: Option<String>,
    pub session_id: Option<Uuid>,
    pub bank_account_id: Option<Uuid>,
    pub payment_method: PaymentMethod,
    pub total_amount: Decimal,
    pub currency: Currency,
    pub notes: Option<String>,
    pub lines: Vec<ReceiptLineRequest>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TreasuryReceiptLineResponse {
    pub id: Uuid,
    pub receipt_id: Uuid,
    pub invoice_id: String,
    pub invoice_number: String,
    pub amount_settled: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<TreasuryReceiptLine> for TreasuryReceiptLineResponse {
    fn from(l: TreasuryReceiptLine) -> Self {
        Self {
            id: l.id,
            receipt_id: l.receipt_id,
            invoice_id: l.invoice_id,
            invoice_number: l.invoice_number,
            amount_settled: l.amount_settled,
            notes: l.notes,
            created_at: l.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TreasuryReceiptResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub receipt_number: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_nif: Option<String>,
    pub session_id: Option<Uuid>,
    pub bank_account_id: Option<Uuid>,
    pub payment_method: PaymentMethod,
    pub total_amount: Decimal,
    pub currency: Currency,
    pub notes: Option<String>,
    pub issued_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub lines: Vec<TreasuryReceiptLineResponse>,
}

impl From<TreasuryReceipt> for TreasuryReceiptResponse {
    fn from(r: TreasuryReceipt) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            receipt_number: r.receipt_number,
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            customer_nif: r.customer_nif,
            session_id: r.session_id,
            bank_account_id: r.bank_account_id,
            payment_method: r.payment_method,
            total_amount: r.total_amount,
            currency: r.currency,
            notes: r.notes,
            issued_at: r.issued_at,
            created_at: r.created_at,
            lines: r.lines.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceReceivableResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: String,
    pub document_number: String,
    pub document_type: String,
    pub payment_mechanism: Option<String>,
    pub gross_total: Decimal,
    pub paid_amount: Decimal,
    pub remaining_amount: Decimal,
    pub status: ReceivableStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<InvoiceReceivable> for InvoiceReceivableResponse {
    fn from(r: InvoiceReceivable) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            invoice_id: r.invoice_id,
            document_number: r.document_number,
            document_type: r.document_type,
            payment_mechanism: r.payment_mechanism,
            gross_total: r.gross_total,
            paid_amount: r.paid_amount,
            remaining_amount: r.remaining_amount,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// -----------------------------------------------------------------------------
// Contas a Pagar (Payables)
// -----------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoicePayableResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub supplier_id: Option<String>,
    pub supplier_name: String,
    pub supplier_nif: Option<String>,
    pub invoice_number: String,
    pub activity_type: String,
    pub category: String,
    pub currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_payable: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_paid: Decimal,
    pub due_date: chrono::NaiveDate,
    pub issue_date: chrono::NaiveDate,
    pub payment_method: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreatePayableRequest {
    pub supplier_id: Option<String>,
    pub supplier_name: String,
    pub supplier_nif: Option<String>,
    pub invoice_number: String,
    pub activity_type: Option<String>,
    pub category: Option<String>,
    pub currency: Option<String>,
    pub gross_total: Decimal,
    pub withholding_rate: Option<Decimal>,
    pub due_date: chrono::NaiveDate,
    pub issue_date: Option<chrono::NaiveDate>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SettlePayableRequest {
    pub bank_account_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub amount_paid: Decimal,
    pub payment_method: PaymentMethod,
    pub payment_reference: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayableSettlementResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub payable_id: Uuid,
    pub bank_account_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_paid: Decimal,
    pub payment_method: String,
    pub payment_reference: Option<String>,
    pub settled_at: DateTime<Utc>,
    pub operator_user_id: String,
    pub notes: Option<String>,
}

// -----------------------------------------------------------------------------
// Transferências Internas (Cash Transfers)
// -----------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashTransferResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub transfer_number: String,
    pub source_type: String,
    pub source_id: Uuid,
    pub source_name: Option<String>,
    pub target_type: String,
    pub target_id: Uuid,
    pub target_name: Option<String>,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub fee_amount: Decimal,
    pub currency: String,
    pub status: String,
    pub operator_user_id: String,
    pub notes: Option<String>,
    pub transferred_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCashTransferRequest {
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub amount: Decimal,
    pub fee_amount: Option<Decimal>,
    pub currency: Option<String>,
    pub notes: Option<String>,
}

// -----------------------------------------------------------------------------
// Conciliação e Extratos Bancários (Bank Statements)
// -----------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankStatementResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub bank_account_id: Uuid,
    pub bank_name: Option<String>,
    pub reference_period: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub start_balance: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub end_balance: Decimal,
    pub statement_date: chrono::NaiveDate,
    pub file_name: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankStatementLineResponse {
    pub id: Uuid,
    pub statement_id: Uuid,
    pub tenant_id: Uuid,
    pub line_date: chrono::NaiveDate,
    pub description: String,
    pub document_ref: Option<String>,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub balance_after: Decimal,
    pub movement_type: String,
    pub is_reconciled: bool,
    pub matched_type: Option<String>,
    pub matched_id: Option<Uuid>,
    pub reconciled_at: Option<DateTime<Utc>>,
    pub reconciled_by: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBankStatementRequest {
    pub bank_account_id: Uuid,
    pub reference_period: String,
    pub start_balance: Decimal,
    pub end_balance: Decimal,
    pub statement_date: chrono::NaiveDate,
    pub file_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBankStatementLineRequest {
    pub line_date: chrono::NaiveDate,
    pub description: String,
    pub document_ref: Option<String>,
    pub amount: Decimal,
    pub balance_after: Decimal,
    pub movement_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReconcileLineRequest {
    pub matched_type: String,
    pub matched_id: Option<Uuid>,
}
