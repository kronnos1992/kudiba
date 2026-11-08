use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::entities::InvoiceReceivable;
use crate::domain::error::DomainError;
use crate::domain::ports::InvoiceReceivableRepository;

pub struct RegisterInvoiceReceivableHandler {
    receivable_repo: Arc<dyn InvoiceReceivableRepository>,
}

impl RegisterInvoiceReceivableHandler {
    pub fn new(receivable_repo: Arc<dyn InvoiceReceivableRepository>) -> Self {
        Self { receivable_repo }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn execute(
        &self,
        tenant_id: Uuid,
        invoice_id: String,
        document_number: String,
        document_type: String,
        payment_mechanism: Option<String>,
        gross_total: Decimal,
    ) -> Result<(), DomainError> {
        let receivable = InvoiceReceivable::new(
            tenant_id,
            invoice_id,
            document_number,
            document_type,
            payment_mechanism,
            gross_total,
        )?;

        self.receivable_repo.upsert(&receivable).await
    }

    pub async fn apply_payment(
        &self,
        tenant_id: Uuid,
        invoice_id: &str,
        payment_id: Uuid,
        amount: Decimal,
    ) -> Result<(), DomainError> {
        self.receivable_repo
            .apply_payment(tenant_id, invoice_id, payment_id, amount)
            .await
    }
}
