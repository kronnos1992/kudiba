use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::entities::{
    BankAccount, CashMovement, CashRegister, CashSession, InvoiceReceivable, ReceivableStatus,
    TreasuryReceiptLine,
};
use crate::domain::value_objects::{Currency, MovementType, PaymentMethod, SessionStatus};

#[derive(Debug, FromRow)]
pub struct CashRegisterRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub branch_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CashRegisterRow> for CashRegister {
    fn from(r: CashRegisterRow) -> Self {
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

#[derive(Debug, FromRow)]
pub struct CashSessionRow {
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

impl From<CashSessionRow> for CashSession {
    fn from(s: CashSessionRow) -> Self {
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

#[derive(Debug, FromRow)]
pub struct PosSessionRow {
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

impl From<PosSessionRow> for crate::domain::entities::PosSession {
    fn from(s: PosSessionRow) -> Self {
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

#[derive(Debug, FromRow)]
pub struct CashMovementRow {
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

impl From<CashMovementRow> for CashMovement {
    fn from(m: CashMovementRow) -> Self {
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

#[derive(Debug, FromRow)]
pub struct BankAccountRow {
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

impl From<BankAccountRow> for BankAccount {
    fn from(b: BankAccountRow) -> Self {
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

#[derive(Debug, FromRow)]
pub struct TreasuryReceiptRow {
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
}

#[derive(Debug, FromRow)]
pub struct TreasuryReceiptLineRow {
    pub id: Uuid,
    pub receipt_id: Uuid,
    pub invoice_id: String,
    pub invoice_number: String,
    pub amount_settled: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<TreasuryReceiptLineRow> for TreasuryReceiptLine {
    fn from(l: TreasuryReceiptLineRow) -> Self {
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

#[derive(Debug, FromRow)]
pub struct InvoiceReceivableRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: String,
    pub document_number: String,
    pub document_type: String,
    pub payment_mechanism: Option<String>,
    pub gross_total: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<InvoiceReceivableRow> for InvoiceReceivable {
    fn from(r: InvoiceReceivableRow) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            invoice_id: r.invoice_id,
            document_number: r.document_number,
            document_type: r.document_type,
            payment_mechanism: r.payment_mechanism,
            gross_total: r.gross_total,
            status: ReceivableStatus::from_db(&r.status),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}
