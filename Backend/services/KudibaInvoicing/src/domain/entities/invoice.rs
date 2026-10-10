use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

use crate::domain::entities::invoice_line::InvoiceLine;
use crate::domain::error::DomainError;
use crate::domain::services::tax_validator::TaxRateValidator;
use crate::domain::value_objects::tax_regime::TaxRegime;

/// NIF/Designação aplicada quando o adquirente é consumidor final
pub const CONSUMIDOR_FINAL: &str = "Consumidor Final";

/// Documento fiscal emitido, assinado digitalmente e gravado de forma imutável.
///
/// Uma vez emitida e persistida, a fatura NÃO pode ser alterada: o trigger
/// `trg_protect_invoices` do PostgreSQL rejeita qualquer `UPDATE`/`DELETE`
/// (Decreto Presidencial n.º 71/25 — AGT Angola). Retificações exigem a
/// emissão legal de uma Nota de Crédito (NC).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub issuer_nif: Option<String>,
    pub issuer_address: Option<String>,
    pub issuer_city: Option<String>,
    pub issuer_country: Option<String>,
    pub series_id: Uuid,
    pub document_number: String,
    pub sequence_number: i64,
    pub document_type: String,
    pub customer_name: String,
    pub customer_nif: String,
    pub customer_address: Option<String>,
    pub customer_city: Option<String>,
    pub customer_country: Option<String>,
    pub source_document_number: Option<String>,
    pub payment_methods: Vec<String>,
    pub currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub stamp_duty_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_due: Decimal,
    pub hash_sha256: String,
    pub signature_rsa_base64: String,
    pub validation_chars: String,
    pub key_version: String,
    pub is_contingency: bool,
    /// Regime de IVA aplicado no momento da emissão (fotografia fiscal imutável)
    pub tax_regime_code: String,
    pub issued_at: DateTime<Utc>,
    pub system_entry_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub lines: Vec<InvoiceLine>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transport: Option<crate::domain::value_objects::transport::TransportMovement>,
}

impl Invoice {
    /// Construtor de emissão: normaliza o NIF do adquirente e carimba as datas fiscais
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: Uuid,
        tenant_id: Uuid,
        issuer_nif: String,
        issuer_address: String,
        issuer_city: String,
        issuer_country: String,
        series_id: Uuid,
        document_number: String,
        sequence_number: i64,
        document_type: String,
        customer_name: String,
        customer_nif: Option<String>,
        customer_address: Option<String>,
        customer_city: Option<String>,
        customer_country: Option<String>,
        source_document_number: Option<String>,
        payment_methods: Vec<String>,
        currency: String,
        net_total: Decimal,
        tax_total: Decimal,
        gross_total: Decimal,
        withholding_total: Decimal,
        stamp_duty_total: Decimal,
        hash_sha256: String,
        signature_rsa_base64: String,
        validation_chars: String,
        key_version: String,
        is_contingency: bool,
        tax_regime_code: String,
        issued_at: DateTime<Utc>,
        system_entry_date: DateTime<Utc>,
        lines: Vec<InvoiceLine>,
    ) -> Self {
        let customer_nif = customer_nif
            .filter(|nif| !nif.trim().is_empty())
            .unwrap_or_else(|| CONSUMIDOR_FINAL.to_string());

        let amount_due = gross_total + stamp_duty_total - withholding_total;
        Self {
            id,
            tenant_id,
            issuer_nif: Some(issuer_nif),
            issuer_address: Some(issuer_address),
            issuer_city: Some(issuer_city),
            issuer_country: Some(issuer_country),
            series_id,
            document_number,
            sequence_number,
            document_type,
            customer_name,
            customer_nif,
            customer_address,
            customer_city,
            customer_country,
            source_document_number,
            payment_methods,
            currency,
            net_total,
            tax_total,
            gross_total,
            withholding_total,
            stamp_duty_total,
            amount_due,
            hash_sha256,
            signature_rsa_base64,
            validation_chars,
            key_version,
            is_contingency,
            tax_regime_code,
            issued_at,
            system_entry_date,
            created_at: Utc::now(),
            lines,
            transport: None,
        }
    }

    /// Atribui metadados logísticos de transporte ao documento fiscal
    pub fn with_transport(
        mut self,
        transport: Option<crate::domain::value_objects::transport::TransportMovement>,
    ) -> Self {
        self.transport = transport;
        self
    }

    /// Confirma que cada linha respeita o regime de IVA congelado no documento
    pub fn verify_tax_regime(&self) -> Result<(), DomainError> {
        let regime = TaxRegime::from_code(&self.tax_regime_code)?;

        TaxRateValidator::validate_lines(
            regime,
            self.lines.iter().enumerate().map(|(index, line)| {
                (
                    index as i32 + 1,
                    line.tax_rate,
                    line.tax_exemption_code.as_deref(),
                )
            }),
        )
        .map_err(|err| DomainError::invalid(format!("Fatura {}: {err}", self.document_number)))
    }

    /// Confirma a coerência aritmética do documento (net + imposto = bruto)
    /// e que a soma das linhas reproduz os totais gravados.
    pub fn verify_totals(&self) -> Result<(), DomainError> {
        if self.lines.is_empty() {
            return Err(DomainError::invalid(format!(
                "Fatura {} não tem linhas de artigo.",
                self.document_number
            )));
        }

        let net_total: Decimal = self.lines.iter().map(|line| line.line_base()).sum();
        let tax_total: Decimal = self.lines.iter().map(|line| line.line_tax()).sum();

        if net_total + tax_total != self.gross_total || net_total != self.net_total {
            return Err(DomainError::invalid(format!(
                "Coerência aritmética violada na fatura {}: linhas {} + {} != {} (gravado {} + {})",
                self.document_number,
                net_total,
                tax_total,
                net_total + tax_total,
                self.net_total,
                self.gross_total
            )));
        }
        if self.gross_total + self.stamp_duty_total - self.withholding_total != self.amount_due {
            return Err(DomainError::invalid(format!(
                "Total liquidável incoerente no documento {}.",
                self.document_number
            )));
        }

        Ok(())
    }
}
