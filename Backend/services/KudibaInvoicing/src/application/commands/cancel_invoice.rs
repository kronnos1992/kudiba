//! Caso de uso de Anulação / Estorno Automático de Documentos Fiscais
//!
//! Em estrita conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas),
//! as faturas emitidas são imutáveis e NÃO podem ser eliminadas. Qualquer retificação,
//! devolução ou anulação exige a emissão legal de uma Nota de Crédito (NC) que referencie
//! o documento original no campo `source_document_number`.

use std::sync::Arc;
use chrono::{Datelike, Utc};

use crate::application::commands::issue_invoice::IssueInvoiceUseCase;
use crate::application::dto::{
    CancelInvoiceCommand, CancelInvoiceResult, InvoiceLineInput, IssueInvoiceCommand,
};
use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};
use crate::domain::ports::invoice_repository::InvoiceRepository;

pub struct CancelInvoiceWithCreditNoteUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    invoice_repository: Arc<dyn InvoiceRepository>,
    issue_invoice: Arc<IssueInvoiceUseCase>,
}

impl CancelInvoiceWithCreditNoteUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        invoice_repository: Arc<dyn InvoiceRepository>,
        issue_invoice: Arc<IssueInvoiceUseCase>,
    ) -> Self {
        Self {
            session_factory,
            invoice_repository,
            issue_invoice,
        }
    }

    pub async fn execute(
        &self,
        command: CancelInvoiceCommand,
    ) -> Result<CancelInvoiceResult, DomainError> {
        // 1. Validação do motivo obrigatório da anulação
        let reason = validate_cancel_reason(&command.reason)?;

        // 2. Consulta do documento original
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        let original_invoice = self
            .invoice_repository
            .find_by_id_for_tenant(session.as_mut(), command.invoice_id, command.tenant_id)
            .await
            .map_err(persistence_error)?
            .ok_or(DomainError::InvoiceNotFound)?;

        // 3. Validação: Não pode anular uma Nota de Crédito
        validate_not_credit_note(&original_invoice.document_type)?;

        // 4. Validação: Não pode anular um documento já estornado
        if let Some(existing_nc) = self
            .invoice_repository
            .find_credit_note_for_source(
                session.as_mut(),
                command.tenant_id,
                &original_invoice.document_number,
            )
            .await
            .map_err(persistence_error)?
        {
            return Err(DomainError::invalid(format!(
                "O documento {} já foi anulado pela Nota de Crédito {}.",
                original_invoice.document_number, existing_nc.document_number
            )));
        }

        // Fecha a sessão de leitura prévia antes de delegar a emissão atómica
        drop(session);

        // 5. Determinação da série fiscal da Nota de Crédito
        let series_code = command.series_code.unwrap_or_else(|| {
            let parts: Vec<&str> = original_invoice.document_number.split_whitespace().collect();
            if parts.len() >= 2 {
                let series_and_seq: Vec<&str> = parts[1].split('/').collect();
                series_and_seq[0].to_string()
            } else {
                "KUD26".to_string()
            }
        });

        // 6. Conversão das linhas originais para as linhas estornadas da NC
        let nc_lines: Vec<InvoiceLineInput> = original_invoice
            .lines
            .iter()
            .map(|l| InvoiceLineInput {
                product_code: l.product_code.clone(),
                description: format!("Anulação: {}", l.description),
                quantity: l.quantity,
                unit_price: l.unit_price,
                discount_amount: if l.discount_amount.is_zero() {
                    None
                } else {
                    Some(l.discount_amount)
                },
                tax_rate: l.tax_rate,
                tax_exemption_code: l.tax_exemption_code.clone(),
                is_service: None,
            })
            .collect();

        // 7. Preparação e emissão atómica da Nota de Crédito
        let issue_command = IssueInvoiceCommand {
            actor_user_id: command.actor_user_id,
            tenant_id: command.tenant_id,
            document_type: "NC".to_string(),
            series_code,
            fiscal_year: Utc::now().year(),
            customer_name: original_invoice.customer_name.clone(),
            customer_address: original_invoice.customer_address.clone(),
            customer_city: original_invoice.customer_city.clone(),
            customer_country: original_invoice.customer_country.clone(),
            customer_nif: Some(original_invoice.customer_nif.clone()),
            source_document_number: Some(original_invoice.document_number.clone()),
            payment_methods: original_invoice.payment_methods.clone(),
            withholding_total: if original_invoice.withholding_total.is_zero() {
                None
            } else {
                Some(original_invoice.withholding_total)
            },
            apply_withholding: None,
            withholding_rate: None,
            stamp_duty_total: if original_invoice.stamp_duty_total.is_zero() {
                None
            } else {
                Some(original_invoice.stamp_duty_total)
            },
            apply_stamp_duty: None,
            stamp_duty_rate: None,
            currency: original_invoice.currency.clone(),
            lines: nc_lines,
            is_contingency: original_invoice.is_contingency,
            key_version: original_invoice.key_version.clone(),
            transport: None,
        };

        let nc_result = self.issue_invoice.execute(issue_command).await?;

        Ok(CancelInvoiceResult {
            original_invoice_id: original_invoice.id,
            original_document_number: original_invoice.document_number,
            credit_note_id: nc_result.invoice_id,
            credit_note_document_number: nc_result.document_number,
            amount_refunded: nc_result.amount_due,
            validation_chars: nc_result.validation_chars,
            reason: reason.to_string(),
            issued_at: nc_result.issued_at,
        })
    }
}

fn validate_cancel_reason(reason: &str) -> Result<&str, DomainError> {
    let trimmed = reason.trim();
    if trimmed.is_empty() {
        return Err(DomainError::invalid(
            "O motivo de anulação / retificação é obrigatório nos termos do Decreto 71/25.",
        ));
    }
    Ok(trimmed)
}

fn validate_not_credit_note(document_type: &str) -> Result<(), DomainError> {
    if document_type == "NC" {
        return Err(DomainError::invalid(
            "Não é permitido emitir uma Nota de Crédito para retificar outra Nota de Crédito.",
        ));
    }
    Ok(())
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(msg) => DomainError::ConcurrencyConflict(msg),
        RepositoryError::Database(msg) => DomainError::Persistence(msg),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejeita_motivo_vazio_ou_apenas_espacos() {
        let err1 = validate_cancel_reason("").unwrap_err();
        match err1 {
            DomainError::InvalidArgument(msg) => {
                assert!(msg.contains("motivo de anulação"));
            }
            _ => panic!("Esperado InvalidArgument"),
        }

        let err2 = validate_cancel_reason("    \n\t ").unwrap_err();
        match err2 {
            DomainError::InvalidArgument(msg) => {
                assert!(msg.contains("motivo de anulação"));
            }
            _ => panic!("Esperado InvalidArgument"),
        }
    }

    #[test]
    fn aceita_motivo_valido() {
        let reason = validate_cancel_reason("  Engano na quantidade facturada  ").unwrap();
        assert_eq!(reason, "Engano na quantidade facturada");
    }

    #[test]
    fn impede_anulacao_de_nota_de_credito() {
        let err = validate_not_credit_note("NC").unwrap_err();
        match err {
            DomainError::InvalidArgument(msg) => {
                assert!(msg.contains("Não é permitido emitir uma Nota de Crédito para retificar outra Nota de Crédito"));
            }
            _ => panic!("Esperado InvalidArgument"),
        }
    }

    #[test]
    fn aceita_anulacao_de_outros_documentos() {
        assert!(validate_not_credit_note("FT").is_ok());
        assert!(validate_not_credit_note("FR").is_ok());
        assert!(validate_not_credit_note("VD").is_ok());
    }
}

