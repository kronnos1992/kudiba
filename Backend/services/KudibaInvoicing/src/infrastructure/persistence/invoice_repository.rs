use std::collections::HashMap;

use async_trait::async_trait;
use rust_decimal::Decimal;
use sqlx::postgres::PgRow;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::entities::invoice::Invoice;
use crate::domain::entities::invoice_line::InvoiceLine;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::invoice_repository::InvoiceRepository;

const SELECT_INVOICE_BY_ID_FOR_TENANT: &str =
    "SELECT id, tenant_id, issuer_nif, issuer_address, issuer_city, issuer_country, \
     series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, customer_address, customer_city, customer_country, \
     source_document_number, payment_methods, \
     withholding_total, stamp_duty_total, currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at, \
     vehicle_registration, carrier_name, carrier_nif, load_address, load_city, load_country, \
     load_date_time, unload_address, unload_city, unload_country, unload_date_time \
     FROM kudiba_core.invoices WHERE id = $1 AND tenant_id = $2";

const SELECT_INVOICE_BY_DOCUMENT: &str =
    "SELECT id, tenant_id, issuer_nif, issuer_address, issuer_city, issuer_country, \
     series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, customer_address, customer_city, customer_country, \
     source_document_number, payment_methods, withholding_total, stamp_duty_total, \
     currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at, \
     vehicle_registration, carrier_name, carrier_nif, load_address, load_city, load_country, \
     load_date_time, unload_address, unload_city, unload_country, unload_date_time \
     FROM kudiba_core.invoices WHERE tenant_id = $1 AND document_number = $2";

const SELECT_CREDIT_NOTE_FOR_SOURCE: &str =
    "SELECT id, tenant_id, issuer_nif, issuer_address, issuer_city, issuer_country, \
     series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, customer_address, customer_city, customer_country, \
     source_document_number, payment_methods, withholding_total, stamp_duty_total, \
     currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at, \
     vehicle_registration, carrier_name, carrier_nif, load_address, load_city, load_country, \
     load_date_time, unload_address, unload_city, unload_country, unload_date_time \
     FROM kudiba_core.invoices \
     WHERE tenant_id = $1 AND source_document_number = $2 AND document_type = 'NC' \
     ORDER BY issued_at DESC LIMIT 1";

const SELECT_INVOICE_LINES: &str =
    "SELECT id, invoice_id, line_number, product_code, description, \
    quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total \
    FROM kudiba_core.invoice_lines WHERE invoice_id = $1 ORDER BY line_number ASC";

const SELECT_INVOICES_BY_PERIOD: &str =
    "SELECT id, tenant_id, issuer_nif, issuer_address, issuer_city, issuer_country, \
     series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, customer_address, customer_city, customer_country, \
     source_document_number, payment_methods, \
     withholding_total, stamp_duty_total, currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at, \
     vehicle_registration, carrier_name, carrier_nif, load_address, load_city, load_country, \
     load_date_time, unload_address, unload_city, unload_country, unload_date_time \
     FROM kudiba_core.invoices \
     WHERE tenant_id = $1 \
       AND EXTRACT(YEAR FROM issued_at)::INT = $2 \
       AND ($3::INT IS NULL OR EXTRACT(MONTH FROM issued_at)::INT = $3) \
     ORDER BY issued_at ASC, sequence_number ASC";

const SELECT_INVOICES_BY_PERIOD_PAGINATED: &str =
    "SELECT id, tenant_id, issuer_nif, issuer_address, issuer_city, issuer_country, \
     series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, customer_address, customer_city, customer_country, \
     source_document_number, payment_methods, \
     withholding_total, stamp_duty_total, currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at, \
     vehicle_registration, carrier_name, carrier_nif, load_address, load_city, load_country, \
     load_date_time, unload_address, unload_city, unload_country, unload_date_time \
     FROM kudiba_core.invoices \
     WHERE tenant_id = $1 \
       AND EXTRACT(YEAR FROM issued_at)::INT = $2 \
       AND ($3::INT IS NULL OR EXTRACT(MONTH FROM issued_at)::INT = $3) \
     ORDER BY issued_at ASC, sequence_number ASC \
     LIMIT $4 OFFSET $5";

const SELECT_LINES_FOR_INVOICES: &str =
    "SELECT id, invoice_id, line_number, product_code, description, \
     quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total \
     FROM kudiba_core.invoice_lines \
     WHERE invoice_id = ANY($1) \
     ORDER BY invoice_id, line_number ASC";

/// Repositório PostgreSQL de documentos fiscais e das respetivas linhas
#[derive(Debug, Default, Clone, Copy)]
pub struct PgInvoiceRepository;

impl PgInvoiceRepository {
    pub const fn new() -> Self {
        Self
    }

    fn map_line(row: &PgRow) -> Result<InvoiceLine, RepositoryError> {
        Ok(InvoiceLine::restore(
            row.try_get("id")?,
            row.try_get("invoice_id")?,
            row.try_get("line_number")?,
            row.try_get("product_code")?,
            row.try_get("description")?,
            row.try_get("quantity")?,
            row.try_get("unit_price")?,
            row.try_get("discount_amount")?,
            row.try_get("tax_rate")?,
            row.try_get("tax_exemption_code")?,
            row.try_get("line_total")?,
        ))
    }

    fn map_invoice(row: &PgRow, lines: Vec<InvoiceLine>) -> Result<Invoice, RepositoryError> {
        let gross_total: Decimal = row.try_get("gross_total")?;
        let withholding_total: Decimal = row.try_get("withholding_total")?;
        let stamp_duty_total: Decimal = row.try_get("stamp_duty_total")?;
        let amount_due = gross_total + stamp_duty_total - withholding_total;

        let vehicle_registration: Option<String> = row.try_get("vehicle_registration").ok().flatten();
        let carrier_name: Option<String> = row.try_get("carrier_name").ok().flatten();
        let carrier_nif: Option<String> = row.try_get("carrier_nif").ok().flatten();
        let load_address: Option<String> = row.try_get("load_address").ok().flatten();
        let load_city: Option<String> = row.try_get("load_city").ok().flatten();
        let load_country: Option<String> = row.try_get("load_country").ok().flatten();
        let load_date_time: Option<chrono::DateTime<chrono::Utc>> = row.try_get("load_date_time").ok().flatten();
        let unload_address: Option<String> = row.try_get("unload_address").ok().flatten();
        let unload_city: Option<String> = row.try_get("unload_city").ok().flatten();
        let unload_country: Option<String> = row.try_get("unload_country").ok().flatten();
        let unload_date_time: Option<chrono::DateTime<chrono::Utc>> = row.try_get("unload_date_time").ok().flatten();

        let transport = if vehicle_registration.is_some() || load_address.is_some() || unload_address.is_some() || load_date_time.is_some() {
            Some(crate::domain::value_objects::transport::TransportMovement {
                vehicle_registration,
                carrier_name,
                carrier_nif,
                load_address,
                load_city,
                load_country,
                load_date_time,
                unload_address,
                unload_city,
                unload_country,
                unload_date_time,
            })
        } else {
            None
        };

        let invoice = Invoice {
            id: row.try_get("id")?,
            tenant_id: row.try_get("tenant_id")?,
            issuer_nif: row.try_get("issuer_nif")?,
            issuer_address: row.try_get("issuer_address")?,
            issuer_city: row.try_get("issuer_city")?,
            issuer_country: row.try_get("issuer_country")?,
            series_id: row.try_get("series_id")?,
            document_number: row.try_get("document_number")?,
            sequence_number: row.try_get("sequence_number")?,
            document_type: row.try_get("document_type")?,
            customer_name: row.try_get("customer_name")?,
            customer_nif: row.try_get("customer_nif")?,
            customer_address: row.try_get("customer_address")?,
            customer_city: row.try_get("customer_city")?,
            customer_country: row.try_get("customer_country")?,
            source_document_number: row.try_get("source_document_number")?,
            payment_methods: row.try_get("payment_methods")?,
            currency: row.try_get("currency")?,
            net_total: row.try_get("net_total")?,
            tax_total: row.try_get("tax_total")?,
            gross_total,
            withholding_total,
            stamp_duty_total,
            amount_due,
            hash_sha256: row.try_get("hash_sha256")?,
            signature_rsa_base64: row.try_get("signature_rsa_base64")?,
            validation_chars: row.try_get("validation_chars")?,
            key_version: row.try_get("key_version")?,
            is_contingency: row.try_get("is_contingency")?,
            tax_regime_code: row.try_get("tax_regime_code")?,
            issued_at: row.try_get("issued_at")?,
            system_entry_date: row.try_get("system_entry_date")?,
            created_at: row.try_get("created_at")?,
            lines,
            transport,
        };

        // Invariantes do agregado: totais coerentes e linhas conformes ao regime
        invoice
            .verify_totals()
            .map_err(|err| RepositoryError::Database(err.to_string()))?;

        Ok(invoice)
    }

    async fn load_lines(
        session: &mut dyn DbSession,
        invoice_id: Uuid,
    ) -> Result<Vec<InvoiceLine>, RepositoryError> {
        let rows = sqlx::query(SELECT_INVOICE_LINES)
            .bind(invoice_id)
            .fetch_all(&mut *session.connection())
            .await?;

        rows.iter().map(Self::map_line).collect()
    }
}

#[async_trait]
impl InvoiceRepository for PgInvoiceRepository {
    async fn save(
        &self,
        session: &mut dyn DbSession,
        invoice: &Invoice,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO kudiba_core.invoices (id, tenant_id, series_id, document_number, \
             sequence_number, document_type, issuer_nif, issuer_address, issuer_city, issuer_country, \
             customer_name, customer_nif, customer_address, \
             customer_city, customer_country, \
             source_document_number, payment_methods, currency, net_total, tax_total, gross_total, \
             withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64, validation_chars, \
             key_version, is_contingency, tax_regime_code, issued_at, system_entry_date, \
             created_at, vehicle_registration, carrier_name, carrier_nif, \
             load_address, load_city, load_country, load_date_time, \
             unload_address, unload_city, unload_country, unload_date_time) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, \
             $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, \
             $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43)",
        )
        .bind(invoice.id)
        .bind(invoice.tenant_id)
        .bind(invoice.series_id)
        .bind(&invoice.document_number)
        .bind(invoice.sequence_number)
        .bind(&invoice.document_type)
        .bind(&invoice.issuer_nif)
        .bind(&invoice.issuer_address)
        .bind(&invoice.issuer_city)
        .bind(&invoice.issuer_country)
        .bind(&invoice.customer_name)
        .bind(&invoice.customer_nif)
        .bind(&invoice.customer_address)
        .bind(&invoice.customer_city)
        .bind(&invoice.customer_country)
        .bind(&invoice.source_document_number)
        .bind(&invoice.payment_methods)
        .bind(&invoice.currency)
        .bind(invoice.net_total)
        .bind(invoice.tax_total)
        .bind(invoice.gross_total)
        .bind(invoice.withholding_total)
        .bind(invoice.stamp_duty_total)
        .bind(&invoice.hash_sha256)
        .bind(&invoice.signature_rsa_base64)
        .bind(&invoice.validation_chars)
        .bind(&invoice.key_version)
        .bind(invoice.is_contingency)
        .bind(&invoice.tax_regime_code)
        .bind(invoice.issued_at)
        .bind(invoice.system_entry_date)
        .bind(invoice.created_at)
        .bind(invoice.transport.as_ref().and_then(|t| t.vehicle_registration.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.carrier_name.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.carrier_nif.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.load_address.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.load_city.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.load_country.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.load_date_time))
        .bind(invoice.transport.as_ref().and_then(|t| t.unload_address.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.unload_city.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.unload_country.as_deref()))
        .bind(invoice.transport.as_ref().and_then(|t| t.unload_date_time))
        .execute(&mut *session.connection())
        .await?;

        for line in &invoice.lines {
            sqlx::query(
                "INSERT INTO kudiba_core.invoice_lines (id, invoice_id, line_number, product_code, \
                 description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            )
            .bind(line.id)
            .bind(line.invoice_id)
            .bind(line.line_number)
            .bind(&line.product_code)
            .bind(&line.description)
            .bind(line.quantity)
            .bind(line.unit_price)
            .bind(line.discount_amount)
            .bind(line.tax_rate)
            .bind(&line.tax_exemption_code)
            .bind(line.line_total)
            .execute(&mut *session.connection())
            .await?;
        }

        let payload = serde_json::json!({
            "invoiceId": invoice.id,
            "tenantId": invoice.tenant_id,
            "issuerNif": invoice.issuer_nif,
            "issuerAddress": invoice.issuer_address,
            "issuerCity": invoice.issuer_city,
            "issuerCountry": invoice.issuer_country,
            "documentNumber": invoice.document_number,
            "documentType": invoice.document_type,
            "sourceDocumentNumber": invoice.source_document_number,
            "customerName": invoice.customer_name,
            "customerNif": invoice.customer_nif,
            "customerAddress": invoice.customer_address,
            "customerCity": invoice.customer_city,
            "customerCountry": invoice.customer_country,
            "paymentMethods": invoice.payment_methods,
            "currency": invoice.currency,
            "taxRegimeCode": invoice.tax_regime_code,
            "issuedAt": invoice.issued_at,
            "systemEntryDate": invoice.system_entry_date,
            "hashSha256": invoice.hash_sha256,
            "signatureRsaBase64": invoice.signature_rsa_base64,
            "validationChars": invoice.validation_chars,
            "netTotal": invoice.net_total.to_string(),
            "taxTotal": invoice.tax_total.to_string(),
            "grossTotal": invoice.gross_total.to_string(),
            "withholdingTotal": invoice.withholding_total.to_string(),
            "stampDutyTotal": invoice.stamp_duty_total.to_string(),
            "amountDue": invoice.amount_due.to_string(),
            "lines": invoice.lines.iter().map(|line| serde_json::json!({
                "lineNumber": line.line_number,
                "productCode": line.product_code,
                "description": line.description,
                "quantity": line.quantity.to_string(),
                "unitPrice": line.unit_price.to_string(),
                "discountAmount": line.discount_amount.to_string(),
                "taxRate": line.tax_rate.to_string(),
                "taxExemptionCode": line.tax_exemption_code,
                "lineTotal": line.line_total.to_string(),
            })).collect::<Vec<_>>(),
        })
        .to_string();
        sqlx::query(
            "INSERT INTO kudiba_core.accounting_outbox \
             (tenant_id, invoice_id, event_type, payload) \
             VALUES ($1, $2, 'fiscal.document.issued', $3::jsonb) \
             ON CONFLICT (invoice_id, event_type) DO NOTHING",
        )
        .bind(invoice.tenant_id)
        .bind(invoice.id)
        .bind(payload)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn find_by_id_for_tenant(
        &self,
        session: &mut dyn DbSession,
        id: Uuid,
        tenant_id: Uuid,
    ) -> Result<Option<Invoice>, RepositoryError> {
        let row = sqlx::query(SELECT_INVOICE_BY_ID_FOR_TENANT)
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&mut *session.connection())
            .await?;

        match row {
            Some(row) => {
                let lines = Self::load_lines(session, id).await?;
                Self::map_invoice(&row, lines).map(Some)
            }
            None => Ok(None),
        }
    }

    async fn find_by_document_number(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_number: &str,
    ) -> Result<Option<Invoice>, RepositoryError> {
        let row = sqlx::query(SELECT_INVOICE_BY_DOCUMENT)
            .bind(tenant_id)
            .bind(document_number)
            .fetch_optional(&mut *session.connection())
            .await?;

        match row {
            Some(row) => {
                let invoice_id: Uuid = row.try_get("id")?;
                let lines = Self::load_lines(session, invoice_id).await?;
                Self::map_invoice(&row, lines).map(Some)
            }
            None => Ok(None),
        }
    }

    async fn find_by_period(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        fiscal_year: i32,
        fiscal_month: Option<u32>,
    ) -> Result<Vec<Invoice>, RepositoryError> {
        let month_param: Option<i32> = fiscal_month.map(|m| m as i32);
        let rows = sqlx::query(SELECT_INVOICES_BY_PERIOD)
            .bind(tenant_id)
            .bind(fiscal_year)
            .bind(month_param)
            .fetch_all(&mut *session.connection())
            .await?;

        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let invoice_ids: Vec<Uuid> = rows
            .iter()
            .map(|r| r.try_get::<Uuid, _>("id"))
            .collect::<Result<Vec<_>, _>>()?;

        let line_rows = sqlx::query(SELECT_LINES_FOR_INVOICES)
            .bind(&invoice_ids)
            .fetch_all(&mut *session.connection())
            .await?;

        let mut lines_by_invoice: HashMap<Uuid, Vec<InvoiceLine>> = HashMap::new();
        for line_row in line_rows {
            let line = Self::map_line(&line_row)?;
            lines_by_invoice
                .entry(line.invoice_id)
                .or_default()
                .push(line);
        }

        let mut invoices = Vec::with_capacity(rows.len());
        for row in rows {
            let id: Uuid = row.try_get("id")?;
            let lines = lines_by_invoice.remove(&id).unwrap_or_default();
            invoices.push(Self::map_invoice(&row, lines)?);
        }

        Ok(invoices)
    }

    async fn find_by_period_paginated(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        fiscal_year: i32,
        fiscal_month: Option<u32>,
        offset: i64,
        limit: i64,
    ) -> Result<Vec<Invoice>, RepositoryError> {
        let month_param: Option<i32> = fiscal_month.map(|m| m as i32);
        let rows = sqlx::query(SELECT_INVOICES_BY_PERIOD_PAGINATED)
            .bind(tenant_id)
            .bind(fiscal_year)
            .bind(month_param)
            .bind(limit)
            .bind(offset)
            .fetch_all(&mut *session.connection())
            .await?;

        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let invoice_ids: Vec<Uuid> = rows
            .iter()
            .map(|r| r.try_get::<Uuid, _>("id"))
            .collect::<Result<Vec<_>, _>>()?;

        let line_rows = sqlx::query(SELECT_LINES_FOR_INVOICES)
            .bind(&invoice_ids)
            .fetch_all(&mut *session.connection())
            .await?;

        let mut lines_by_invoice: HashMap<Uuid, Vec<InvoiceLine>> = HashMap::new();
        for line_row in line_rows {
            let line = Self::map_line(&line_row)?;
            lines_by_invoice
                .entry(line.invoice_id)
                .or_default()
                .push(line);
        }

        let mut invoices = Vec::with_capacity(rows.len());
        for row in rows {
            let id: Uuid = row.try_get("id")?;
            let lines = lines_by_invoice.remove(&id).unwrap_or_default();
            invoices.push(Self::map_invoice(&row, lines)?);
        }

        Ok(invoices)
    }

    async fn find_credit_note_for_source(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        source_document_number: &str,
    ) -> Result<Option<Invoice>, RepositoryError> {
        let row = sqlx::query(SELECT_CREDIT_NOTE_FOR_SOURCE)
            .bind(tenant_id)
            .bind(source_document_number)
            .fetch_optional(&mut *session.connection())
            .await?;

        match row {
            Some(row) => {
                let invoice_id: Uuid = row.try_get("id")?;
                let lines = Self::load_lines(session, invoice_id).await?;
                Self::map_invoice(&row, lines).map(Some)
            }
            None => Ok(None),
        }
    }
}
