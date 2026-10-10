//! Relatórios Diários de Caixa e Memória Fiscal POS: Leitura X e Fecho Z
//!
//! Em estrita conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas)
//! e especificações técnicas de Pontos de Venda (POS) homologados pela AGT.
//!
//! - **Leitura X (X-Report)**: Leitura de controlo intradiária / fim de turno sem fechar o dia
//!   nem zerar acumuladores fiscais.
//! - **Fecho Z (Z-Report)**: Encerramento fiscal diário obrigatório com emissão de número
//!   sequencial Z (ex.: `Z 2026/000001`), congelação dos acumuladores e gravação em arquivo.

use std::sync::Arc;
use chrono::{DateTime, NaiveDate, Utc};
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDailyReportQuery {
    pub tenant_id: Uuid,
    pub date: NaiveDate,
    pub pos_terminal_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseZReportCommand {
    #[serde(skip)]
    pub actor_user_id: Option<String>,
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    pub date: NaiveDate,
    pub pos_terminal_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosTaxBreakdown {
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub taxable_base: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosPaymentBreakdown {
    pub payment_method: String,
    pub payment_method_name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_amount: Decimal,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosDailyReportResult {
    pub report_type: String, // "LEITURA_X" ou "FECHO_Z"
    pub tenant_id: Uuid,
    pub company_name: String,
    pub company_nif: String,
    pub agt_cert_number: String,
    pub date: NaiveDate,
    pub generated_at: DateTime<Utc>,
    pub z_report_sequence: Option<i64>,
    pub z_report_number: Option<String>,
    pub pos_terminal_id: Option<String>,

    pub first_document_number: Option<String>,
    pub last_document_number: Option<String>,
    pub invoices_count: i64,
    pub credit_notes_count: i64,

    #[serde(with = "rust_decimal::serde::float")]
    pub gross_sales_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub discounts_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub credit_notes_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_sales_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub vat_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub stamp_duty_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub final_total: Decimal,

    pub taxes: Vec<PosTaxBreakdown>,
    pub payments: Vec<PosPaymentBreakdown>,
}

pub struct PosReportsUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
}

impl PosReportsUseCase {
    pub fn new(session_factory: Arc<dyn DbSessionFactory>) -> Self {
        Self { session_factory }
    }

    /// Emite a Leitura X (X-Report) — Consulta de controlo intradiária em tempo real
    pub async fn execute_leitura_x(
        &self,
        query: PosDailyReportQuery,
    ) -> Result<PosDailyReportResult, DomainError> {
        let mut report = self.calculate_daily_summary(query.tenant_id, query.date, query.pos_terminal_id.as_deref()).await?;
        report.report_type = "LEITURA_X".to_string();
        Ok(report)
    }

    /// Emite o Fecho Z (Z-Report) — Fecho fiscal diário oficial obrigatório
    pub async fn execute_fecho_z(
        &self,
        command: CloseZReportCommand,
    ) -> Result<PosDailyReportResult, DomainError> {
        let mut session = self.session_factory.open().await.map_err(persistence_error)?;

        // 1. Verifica se já existe um Fecho Z para a mesma data (idempotência fiscal diária)
        let existing = sqlx::query(
            "SELECT z_number, sequence_number, taxes_summary, payment_methods_summary \
             FROM kudiba_core.pos_z_reports \
             WHERE tenant_id = $1 AND closing_date = $2 \
               AND ($3::TEXT IS NULL OR pos_terminal_id = $3)",
        )
        .bind(command.tenant_id)
        .bind(command.date)
        .bind(command.pos_terminal_id.as_deref())
        .fetch_optional(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        if let Some(row) = existing {
            let z_num: String = row.try_get("z_number").map_err(|e| DomainError::Persistence(e.to_string()))?;
            let seq: i64 = row.try_get("sequence_number").map_err(|e| DomainError::Persistence(e.to_string()))?;
            let mut report = self.calculate_daily_summary(command.tenant_id, command.date, command.pos_terminal_id.as_deref()).await?;
            report.report_type = "FECHO_Z".to_string();
            report.z_report_sequence = Some(seq);
            report.z_report_number = Some(z_num);
            return Ok(report);
        }

        // 2. Calcula os acumuladores do dia
        let mut report = self.calculate_daily_summary(command.tenant_id, command.date, command.pos_terminal_id.as_deref()).await?;
        report.report_type = "FECHO_Z".to_string();

        // 3. Obtém o próximo número sequencial Z do ano fiscal
        let next_seq_row = sqlx::query(
            "SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq \
             FROM kudiba_core.pos_z_reports \
             WHERE tenant_id = $1 AND fiscal_year = $2",
        )
        .bind(command.tenant_id)
        .bind(command.fiscal_year)
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let next_seq: i64 = next_seq_row
            .try_get("next_seq")
            .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let z_number = format!("Z {}/{:06}", command.fiscal_year, next_seq);
        report.z_report_sequence = Some(next_seq);
        report.z_report_number = Some(z_number.clone());

        // 4. Grava o Fecho Z de forma imutável
        let taxes_json_str = serde_json::to_string(&report.taxes)
            .map_err(|e| DomainError::invalid(format!("Erro ao serializar taxas: {e}")))?;
        let payments_json_str = serde_json::to_string(&report.payments)
            .map_err(|e| DomainError::invalid(format!("Erro ao serializar pagamentos: {e}")))?;

        let opened_at = command.date.and_hms_opt(0, 0, 0).unwrap_or_default().and_utc();
        let closed_at = Utc::now();

        sqlx::query(
            "INSERT INTO kudiba_core.pos_z_reports ( \
                tenant_id, fiscal_year, sequence_number, z_number, closing_date, \
                pos_terminal_id, opened_at, closed_at, first_document_number, last_document_number, \
                invoices_count, credit_notes_count, gross_sales_total, discounts_total, \
                credit_notes_total, net_sales_total, vat_total, withholding_total, \
                stamp_duty_total, final_total, taxes_summary, payment_methods_summary, actor_user_id \
             ) VALUES ( \
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, \
                $17, $18, $19, $20, $21::jsonb, $22::jsonb, $23 \
             )",
        )
        .bind(command.tenant_id)
        .bind(command.fiscal_year)
        .bind(next_seq)
        .bind(&z_number)
        .bind(command.date)
        .bind(command.pos_terminal_id.as_deref())
        .bind(opened_at)
        .bind(closed_at)
        .bind(report.first_document_number.as_deref())
        .bind(report.last_document_number.as_deref())
        .bind(report.invoices_count)
        .bind(report.credit_notes_count)
        .bind(report.gross_sales_total)
        .bind(report.discounts_total)
        .bind(report.credit_notes_total)
        .bind(report.net_sales_total)
        .bind(report.vat_total)
        .bind(report.withholding_total)
        .bind(report.stamp_duty_total)
        .bind(report.final_total)
        .bind(taxes_json_str)
        .bind(payments_json_str)
        .bind(command.actor_user_id.as_deref())
        .execute(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        Ok(report)
    }

    /// Calcula os acumuladores e desdobramentos diários da base de dados
    async fn calculate_daily_summary(
        &self,
        tenant_id: Uuid,
        date: NaiveDate,
        _pos_terminal_id: Option<&str>,
    ) -> Result<PosDailyReportResult, DomainError> {
        let mut session = self.session_factory.open().await.map_err(persistence_error)?;

        // 1. Dados da Empresa
        let tenant_row = sqlx::query(
            "SELECT company_name, nif, agt_cert_number FROM kudiba_core.tenants WHERE id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let (company_name, company_nif, agt_cert_number) = match tenant_row {
            Some(row) => (
                row.try_get("company_name").unwrap_or_else(|_| "Kudiba ERP".to_string()),
                row.try_get("nif").unwrap_or_else(|_| "999999999".to_string()),
                row.try_get("agt_cert_number").unwrap_or_else(|_| "CERT-AGT-2026/0001".to_string()),
            ),
            None => (
                "Kudiba ERP".to_string(),
                "999999999".to_string(),
                "CERT-AGT-2026/0001".to_string(),
            ),
        };

        let start_time = date.and_hms_opt(0, 0, 0).unwrap().and_utc();
        let end_time = date.and_hms_opt(23, 59, 59).unwrap().and_utc();

        // 2. Acumuladores e Contadores de Documentos
        let totals_row = sqlx::query(
            "SELECT \
                COUNT(CASE WHEN document_type != 'NC' THEN 1 END) AS invoices_count, \
                COUNT(CASE WHEN document_type = 'NC' THEN 1 END) AS credit_notes_count, \
                COALESCE(SUM(CASE WHEN document_type != 'NC' THEN gross_total ELSE 0 END), 0) AS gross_sales_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN gross_total ELSE 0 END), 0) AS credit_notes_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -net_total ELSE net_total END), 0) AS net_sales_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -tax_total ELSE tax_total END), 0) AS vat_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -withholding_total ELSE withholding_total END), 0) AS withholding_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -stamp_duty_total ELSE stamp_duty_total END), 0) AS stamp_duty_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -amount_due ELSE amount_due END), 0) AS final_total, \
                MIN(document_number) FILTER (WHERE document_type != 'NC') AS first_document_number, \
                MAX(document_number) FILTER (WHERE document_type != 'NC') AS last_document_number \
             FROM kudiba_core.invoices \
             WHERE tenant_id = $1 AND issued_at >= $2 AND issued_at <= $3",
        )
        .bind(tenant_id)
        .bind(start_time)
        .bind(end_time)
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        // 3. Desconto Total das Linhas
        let discount_row = sqlx::query(
            "SELECT COALESCE(SUM(l.discount_amount), 0) AS discounts_total \
             FROM kudiba_core.invoices i \
             JOIN kudiba_core.invoice_lines l ON l.invoice_id = i.id \
             WHERE i.tenant_id = $1 AND i.issued_at >= $2 AND i.issued_at <= $3 AND i.document_type != 'NC'",
        )
        .bind(tenant_id)
        .bind(start_time)
        .bind(end_time)
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let discounts_total: Decimal = discount_row
            .try_get("discounts_total")
            .unwrap_or(Decimal::ZERO);

        // 4. Desdobramento de IVA por Taxa
        let vat_rows = sqlx::query(
            "SELECT l.tax_rate, \
                    SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                        (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount)) AS taxable_base, \
                    SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                        (l.line_total - (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount))) AS tax_amount \
             FROM kudiba_core.invoices i \
             JOIN kudiba_core.invoice_lines l ON l.invoice_id = i.id \
             WHERE i.tenant_id = $1 AND i.issued_at >= $2 AND i.issued_at <= $3 \
             GROUP BY l.tax_rate \
             ORDER BY l.tax_rate DESC",
        )
        .bind(tenant_id)
        .bind(start_time)
        .bind(end_time)
        .fetch_all(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let taxes: Vec<PosTaxBreakdown> = vat_rows
            .into_iter()
            .map(|row| {
                Ok(PosTaxBreakdown {
                    tax_rate: row.try_get("tax_rate").map_err(|e: sqlx::Error| DomainError::Persistence(e.to_string()))?,
                    taxable_base: row.try_get("taxable_base").map_err(|e: sqlx::Error| DomainError::Persistence(e.to_string()))?,
                    tax_amount: row.try_get("tax_amount").map_err(|e: sqlx::Error| DomainError::Persistence(e.to_string()))?,
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?;

        // 5. Desdobramento de Pagamentos
        let payment_rows = sqlx::query(
            "SELECT pm, \
                    SUM(CASE WHEN i.document_type = 'NC' THEN -i.amount_due ELSE i.amount_due END) AS total_amount, \
                    COUNT(i.id) AS tx_count \
             FROM kudiba_core.invoices i, \
                  UNNEST(i.payment_methods) AS pm \
             WHERE i.tenant_id = $1 AND i.issued_at >= $2 AND i.issued_at <= $3 \
             GROUP BY pm \
             ORDER BY total_amount DESC",
        )
        .bind(tenant_id)
        .bind(start_time)
        .bind(end_time)
        .fetch_all(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let payments: Vec<PosPaymentBreakdown> = payment_rows
            .into_iter()
            .map(|row| {
                let code: String = row.try_get("pm").map_err(|e: sqlx::Error| DomainError::Persistence(e.to_string()))?;
                let name = map_payment_method_name(&code);
                Ok(PosPaymentBreakdown {
                    payment_method: code,
                    payment_method_name: name,
                    total_amount: row.try_get("total_amount").map_err(|e: sqlx::Error| DomainError::Persistence(e.to_string()))?,
                    transaction_count: row.try_get("tx_count").map_err(|e: sqlx::Error| DomainError::Persistence(e.to_string()))?,
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?;

        Ok(PosDailyReportResult {
            report_type: "LEITURA_X".to_string(),
            tenant_id,
            company_name,
            company_nif,
            agt_cert_number,
            date,
            generated_at: Utc::now(),
            z_report_sequence: None,
            z_report_number: None,
            pos_terminal_id: _pos_terminal_id.map(|s| s.to_string()),
            first_document_number: totals_row.try_get("first_document_number").ok(),
            last_document_number: totals_row.try_get("last_document_number").ok(),
            invoices_count: totals_row.try_get("invoices_count").unwrap_or(0),
            credit_notes_count: totals_row.try_get("credit_notes_count").unwrap_or(0),
            gross_sales_total: totals_row.try_get("gross_sales_total").unwrap_or(Decimal::ZERO),
            discounts_total,
            credit_notes_total: totals_row.try_get("credit_notes_total").unwrap_or(Decimal::ZERO),
            net_sales_total: totals_row.try_get("net_sales_total").unwrap_or(Decimal::ZERO),
            vat_total: totals_row.try_get("vat_total").unwrap_or(Decimal::ZERO),
            withholding_total: totals_row.try_get("withholding_total").unwrap_or(Decimal::ZERO),
            stamp_duty_total: totals_row.try_get("stamp_duty_total").unwrap_or(Decimal::ZERO),
            final_total: totals_row.try_get("final_total").unwrap_or(Decimal::ZERO),
            taxes,
            payments,
        })
    }

    /// Renderiza o relatório em formato texto para impressora térmica de talões 80mm (ESC/POS - 48 colunas)
    pub fn render_thermal_text(report: &PosDailyReportResult) -> String {
        let width = 48;
        let mut out = String::with_capacity(2048);

        let title = if report.report_type == "FECHO_Z" {
            "FECHO FISCAL Z - POS"
        } else {
            "LEITURA DE CONTROLO X - POS"
        };

        out.push_str(&"=".repeat(width));
        out.push('\n');
        out.push_str(&center_text(&report.company_name, width));
        out.push('\n');
        out.push_str(&center_text(&format!("NIF: {}", report.company_nif), width));
        out.push('\n');
        out.push_str(&"=".repeat(width));
        out.push('\n');
        out.push_str(&center_text(title, width));
        out.push('\n');

        if let Some(ref z_num) = report.z_report_number {
            out.push_str(&center_text(&format!("NUMERO: {}", z_num), width));
            out.push('\n');
        }

        out.push_str(&format!(
            "Data: {}    Hora: {}\n",
            report.date.format("%Y-%m-%d"),
            report.generated_at.format("%H:%M:%S")
        ));
        if let Some(ref term) = report.pos_terminal_id {
            out.push_str(&format!("Terminal: {}\n", term));
        }
        out.push_str(&"-".repeat(width));
        out.push('\n');

        out.push_str(&format!(
            "Primeiro Doc: {}\n",
            report.first_document_number.as_deref().unwrap_or("Nenhum")
        ));
        out.push_str(&format!(
            "Ultimo Doc:   {}\n",
            report.last_document_number.as_deref().unwrap_or("Nenhum")
        ));
        out.push_str(&format!(
            "Qtd Faturas: {:<12} Qtd NC: {:<12}\n",
            report.invoices_count, report.credit_notes_count
        ));
        out.push_str(&"-".repeat(width));
        out.push('\n');

        out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Vendas Brutas:", report.gross_sales_total));
        if !report.discounts_total.is_zero() {
            out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Descontos Comerciais:", -report.discounts_total));
        }
        if !report.credit_notes_total.is_zero() {
            out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Notas de Credito (NC):", -report.credit_notes_total));
        }
        out.push_str(&"-".repeat(width));
        out.push('\n');
        out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Incidencia Liquida:", report.net_sales_total));
        out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Total IVA Liquidado:", report.vat_total));
        if !report.stamp_duty_total.is_zero() {
            out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Imposto de Selo:", report.stamp_duty_total));
        }
        if !report.withholding_total.is_zero() {
            out.push_str(&format!("{:<28} {:>15.2} AOA\n", "Retencao na Fonte:", -report.withholding_total));
        }
        out.push_str(&"=".repeat(width));
        out.push('\n');
        out.push_str(&format!("{:<24} {:>19.2} AOA\n", "TOTAL GERAL FATURADO:", report.final_total));
        out.push_str(&"=".repeat(width));
        out.push('\n');

        if !report.taxes.is_empty() {
            out.push_str(&center_text("DESDOBRAMENTO DE IVA", width));
            out.push('\n');
            out.push_str(&format!("{:<10} {:>17} {:>17}\n", "Taxa", "Incidencia", "Imposto"));
            out.push_str(&"-".repeat(width));
            out.push('\n');
            for t in &report.taxes {
                let rate_str = if t.tax_rate.is_zero() {
                    "0.00% (Is)".to_string()
                } else {
                    format!("{:.2}%", t.tax_rate)
                };
                out.push_str(&format!("{:<10} {:>17.2} {:>17.2}\n", rate_str, t.taxable_base, t.tax_amount));
            }
            out.push_str(&"-".repeat(width));
            out.push('\n');
        }

        if !report.payments.is_empty() {
            out.push_str(&center_text("MEIOS DE PAGAMENTO", width));
            out.push('\n');
            out.push_str(&format!("{:<22} {:>6} {:>16}\n", "Forma", "Qtd", "Total"));
            out.push_str(&"-".repeat(width));
            out.push('\n');
            for p in &report.payments {
                out.push_str(&format!("{:<22} {:>6} {:>16.2}\n", p.payment_method_name, p.transaction_count, p.total_amount));
            }
            out.push_str(&"-".repeat(width));
            out.push('\n');
        }

        let cert_info = format!("Validado AGT: {}", report.agt_cert_number);
        out.push_str(&center_text(&cert_info, width));
        out.push('\n');
        let footer = if report.report_type == "FECHO_Z" {
            "*** ENCERRAMENTO FISCAL Z CONCLUIDO ***"
        } else {
            "*** LEITURA X - NAO SERVE DE FATURA ***"
        };
        out.push_str(&center_text(footer, width));
        out.push('\n');
        out.push_str(&"=".repeat(width));
        out.push('\n');

        out
    }

    /// Renderiza o relatório em PDF térmico com largura 80mm (226 pt)
    pub fn render_thermal_pdf(report: &PosDailyReportResult) -> Result<Vec<u8>, DomainError> {
        let page_width = 226.0; // 80mm em pontos PDF
        let lines_count = (report.taxes.len() + report.payments.len()) as f64;
        let page_height = 480.0 + (lines_count * 16.0);

        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        let font_regular_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });

        let font_bold_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica-Bold",
        });

        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_regular_id,
                "F2" => font_bold_id,
            },
        });

        let mut operations: Vec<Operation> = Vec::new();
        let mut y = page_height - 20.0;

        // Cabeçalho da Empresa
        add_centered_pdf_text(&mut operations, "F2", 11.0, y, &report.company_name, page_width, (0.0, 0.0, 0.0));
        y -= 13.0;
        add_centered_pdf_text(&mut operations, "F1", 8.0, y, &format!("NIF: {}", report.company_nif), page_width, (0.2, 0.2, 0.2));
        y -= 14.0;

        let title = if report.report_type == "FECHO_Z" {
            "FECHO FISCAL Z - POS"
        } else {
            "LEITURA DE CONTROLO X"
        };
        add_centered_pdf_text(&mut operations, "F2", 10.0, y, title, page_width, (0.0, 0.0, 0.0));
        y -= 12.0;

        if let Some(ref z_num) = report.z_report_number {
            add_centered_pdf_text(&mut operations, "F2", 9.0, y, &format!("N.º {}", z_num), page_width, (0.1, 0.1, 0.1));
            y -= 12.0;
        }

        add_pdf_line(&mut operations, 10.0, y, page_width - 10.0, y, 1.0);
        y -= 12.0;

        add_pdf_text(&mut operations, "F1", 7.5, 12.0, y, &format!("Data: {}", report.date), (0.2, 0.2, 0.2));
        add_pdf_text(&mut operations, "F1", 7.5, 115.0, y, &format!("Hora: {}", report.generated_at.format("%H:%M:%S")), (0.2, 0.2, 0.2));
        y -= 11.0;

        add_pdf_text(&mut operations, "F1", 7.0, 12.0, y, &format!("Docs: {} Faturas | {} NCs", report.invoices_count, report.credit_notes_count), (0.2, 0.2, 0.2));
        y -= 12.0;

        add_pdf_line(&mut operations, 10.0, y, page_width - 10.0, y, 0.5);
        y -= 12.0;

        // Linhas financeiras
        add_pdf_row(&mut operations, "Vendas Brutas:", &format!("{:.2} AOA", report.gross_sales_total), 12.0, page_width - 12.0, y, false);
        y -= 11.0;

        if !report.credit_notes_total.is_zero() {
            add_pdf_row(&mut operations, "Notas de Credito:", &format!("-{:.2} AOA", report.credit_notes_total), 12.0, page_width - 12.0, y, false);
            y -= 11.0;
        }

        add_pdf_row(&mut operations, "Incidencia Liquida:", &format!("{:.2} AOA", report.net_sales_total), 12.0, page_width - 12.0, y, false);
        y -= 11.0;
        add_pdf_row(&mut operations, "IVA Liquidado:", &format!("{:.2} AOA", report.vat_total), 12.0, page_width - 12.0, y, false);
        y -= 13.0;

        add_pdf_line(&mut operations, 10.0, y, page_width - 10.0, y, 1.0);
        y -= 13.0;
        add_pdf_row(&mut operations, "TOTAL FATURADO:", &format!("{:.2} AOA", report.final_total), 12.0, page_width - 12.0, y, true);
        y -= 14.0;
        add_pdf_line(&mut operations, 10.0, y, page_width - 10.0, y, 1.0);
        y -= 14.0;

        // Desdobramento de IVA
        if !report.taxes.is_empty() {
            add_centered_pdf_text(&mut operations, "F2", 8.0, y, "RESUMO DE IVA", page_width, (0.0, 0.0, 0.0));
            y -= 11.0;
            for t in &report.taxes {
                let rate_label = if t.tax_rate.is_zero() { "Isento (0%)".to_string() } else { format!("{:.1}%", t.tax_rate) };
                let val_str = format!("Base: {:.2} | IVA: {:.2}", t.taxable_base, t.tax_amount);
                add_pdf_row(&mut operations, &rate_label, &val_str, 12.0, page_width - 12.0, y, false);
                y -= 10.0;
            }
            y -= 4.0;
        }

        // Meios de Pagamento
        if !report.payments.is_empty() {
            add_centered_pdf_text(&mut operations, "F2", 8.0, y, "MEIOS DE PAGAMENTO", page_width, (0.0, 0.0, 0.0));
            y -= 11.0;
            for p in &report.payments {
                add_pdf_row(&mut operations, &p.payment_method_name, &format!("{:.2} AOA", p.total_amount), 12.0, page_width - 12.0, y, false);
                y -= 10.0;
            }
            y -= 4.0;
        }

        add_pdf_line(&mut operations, 10.0, y, page_width - 10.0, y, 0.5);
        y -= 12.0;

        let footer = if report.report_type == "FECHO_Z" {
            "*** ENCERRAMENTO FISCAL Z CONCLUIDO ***"
        } else {
            "*** LEITURA X - CONTROLO INTERNO ***"
        };
        add_centered_pdf_text(&mut operations, "F2", 7.5, y, footer, page_width, (0.1, 0.1, 0.1));
        y -= 10.0;
        add_centered_pdf_text(&mut operations, "F1", 6.5, y, &format!("Software Certificado AGT: {}", report.agt_cert_number), page_width, (0.4, 0.4, 0.4));

        let content_stream = Stream::new(dictionary! {}, Content { operations }.encode().map_err(|e| DomainError::invalid(e.to_string()))?);
        let content_id = doc.add_object(content_stream);

        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), page_width.into(), page_height.into()],
            "Contents" => content_id,
            "Resources" => resources_id,
        });

        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut buffer = Vec::new();
        doc.save_to(&mut buffer)
            .map_err(|err| DomainError::invalid(format!("Falha ao gerar PDF de fecho POS: {err}")))?;

        Ok(buffer)
    }
}

fn map_payment_method_name(code: &str) -> String {
    match code.to_uppercase().as_str() {
        "NU" => "Numerário (Cash)".to_string(),
        "TB" => "Transferência Bancária".to_string(),
        "MB" | "CC" | "CD" => "TPA / Multicaixa".to_string(),
        "CH" => "Cheque".to_string(),
        "OU" => "Outro Meio".to_string(),
        other => other.to_string(),
    }
}

fn center_text(text: &str, width: usize) -> String {
    if text.len() >= width {
        text[..width].to_string()
    } else {
        let left = (width - text.len()) / 2;
        format!("{}{}", " ".repeat(left), text)
    }
}

fn add_pdf_text(
    operations: &mut Vec<Operation>,
    font: &str,
    size: f64,
    x: f64,
    y: f64,
    text: &str,
    color: (f64, f64, f64),
) {
    operations.push(Operation::new("q", vec![]));
    operations.push(Operation::new("BT", vec![]));
    operations.push(Operation::new("rg", vec![color.0.into(), color.1.into(), color.2.into()]));
    operations.push(Operation::new("Tf", vec![font.to_string().into(), size.into()]));
    operations.push(Operation::new("Td", vec![x.into(), y.into()]));
    operations.push(Operation::new("Tj", vec![Object::string_literal(text)]));
    operations.push(Operation::new("ET", vec![]));
    operations.push(Operation::new("Q", vec![]));
}

fn add_centered_pdf_text(
    operations: &mut Vec<Operation>,
    font: &str,
    size: f64,
    y: f64,
    text: &str,
    page_width: f64,
    color: (f64, f64, f64),
) {
    let approx_char_width = size * 0.48;
    let text_width = text.len() as f64 * approx_char_width;
    let x = ((page_width - text_width) / 2.0).max(6.0);
    add_pdf_text(operations, font, size, x, y, text, color);
}

fn add_pdf_row(
    operations: &mut Vec<Operation>,
    label: &str,
    value: &str,
    left_x: f64,
    right_x: f64,
    y: f64,
    is_bold: bool,
) {
    let font = if is_bold { "F2" } else { "F1" };
    let size = if is_bold { 8.5 } else { 7.5 };
    let color = if is_bold { (0.0, 0.0, 0.0) } else { (0.2, 0.2, 0.2) };
    add_pdf_text(operations, font, size, left_x, y, label, color);

    let approx_char_width = size * 0.50;
    let val_width = value.len() as f64 * approx_char_width;
    let val_x = (right_x - val_width).max(left_x + 50.0);
    add_pdf_text(operations, font, size, val_x, y, value, color);
}

fn add_pdf_line(
    operations: &mut Vec<Operation>,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    width: f64,
) {
    operations.push(Operation::new("q", vec![]));
    operations.push(Operation::new("w", vec![width.into()]));
    operations.push(Operation::new("RG", vec![0.3.into(), 0.3.into(), 0.3.into()]));
    operations.push(Operation::new("m", vec![x1.into(), y1.into()]));
    operations.push(Operation::new("l", vec![x2.into(), y2.into()]));
    operations.push(Operation::new("S", vec![]));
    operations.push(Operation::new("Q", vec![]));
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
    fn renderiza_leitura_x_e_fecho_z_em_texto_termico_corretamente() {
        let report = PosDailyReportResult {
            report_type: "FECHO_Z".to_string(),
            tenant_id: Uuid::new_v4(),
            company_name: "Supermercado Kudiba Lda".to_string(),
            company_nif: "5412345678".to_string(),
            agt_cert_number: "CERT-AGT-2026/0042".to_string(),
            date: NaiveDate::from_ymd_opt(2026, 10, 7).unwrap(),
            generated_at: Utc::now(),
            z_report_sequence: Some(15),
            z_report_number: Some("Z 2026/000015".to_string()),
            pos_terminal_id: Some("POS-01".to_string()),
            first_document_number: Some("FT KUD26/000001".to_string()),
            last_document_number: Some("FT KUD26/000042".to_string()),
            invoices_count: 42,
            credit_notes_count: 2,
            gross_sales_total: Decimal::from(1500000),
            discounts_total: Decimal::from(50000),
            credit_notes_total: Decimal::from(100000),
            net_sales_total: Decimal::from(1350000),
            vat_total: Decimal::from(189000),
            withholding_total: Decimal::ZERO,
            stamp_duty_total: Decimal::from(5000),
            final_total: Decimal::from(1544000),
            taxes: vec![
                PosTaxBreakdown {
                    tax_rate: Decimal::from(14),
                    taxable_base: Decimal::from(1000000),
                    tax_amount: Decimal::from(140000),
                },
                PosTaxBreakdown {
                    tax_rate: Decimal::ZERO,
                    taxable_base: Decimal::from(350000),
                    tax_amount: Decimal::ZERO,
                },
            ],
            payments: vec![
                PosPaymentBreakdown {
                    payment_method: "NU".to_string(),
                    payment_method_name: "Numerário (Cash)".to_string(),
                    total_amount: Decimal::from(544000),
                    transaction_count: 25,
                },
                PosPaymentBreakdown {
                    payment_method: "MB".to_string(),
                    payment_method_name: "TPA / Multicaixa".to_string(),
                    total_amount: Decimal::from(1000000),
                    transaction_count: 19,
                },
            ],
        };

        let text = PosReportsUseCase::render_thermal_text(&report);
        assert!(text.contains("FECHO FISCAL Z - POS"));
        assert!(text.contains("Z 2026/000015"));
        assert!(text.contains("Supermercado Kudiba Lda"));
        assert!(text.contains("Numerário (Cash)"));
        assert!(text.contains("TPA / Multicaixa"));
        assert!(text.contains("1544000.00 AOA"));

        let pdf = PosReportsUseCase::render_thermal_pdf(&report).expect("PDF térmico");
        assert!(!pdf.is_empty());
        assert!(pdf.starts_with(b"%PDF-"));
    }
}
