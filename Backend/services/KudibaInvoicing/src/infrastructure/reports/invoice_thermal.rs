//! Gerador de Talões de Venda Térmicos (80mm) para POS
//!
//! Em estrita conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas)
//! Suporta emissão em formato PDF (bobina 80mm) e texto formatado a 48 colunas (ESC/POS).

use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};

use crate::domain::entities::invoice::Invoice;
use crate::domain::error::DomainError;
use crate::domain::services::fiscal_qr::AgtQrCodeService;

pub struct InvoiceThermalGenerator;

impl InvoiceThermalGenerator {
    /// Gera o talão em PDF com largura de 80mm (226 pt) e altura proporcional
    pub fn generate_pdf(
        invoice: &Invoice,
        company_name: &str,
        software_cert: &str,
    ) -> Result<Vec<u8>, DomainError> {
        let page_width = 226.0; // 80mm em pontos PDF (80 * 72 / 25.4)
        let line_count = invoice.lines.len() as f64;
        let page_height = 430.0 + (line_count * 20.0);

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

        // Cabeçalho da Empresa (Centrado)
        Self::add_centered_text(&mut operations, "F2", 11.0, y, company_name, page_width, (0.0, 0.0, 0.0));
        y -= 13.0;

        let issuer_nif = invoice.issuer_nif.as_deref().unwrap_or("999999999");
        Self::add_centered_text(&mut operations, "F1", 8.0, y, &format!("NIF: {}", issuer_nif), page_width, (0.2, 0.2, 0.2));
        y -= 11.0;

        let issuer_city = invoice.issuer_city.as_deref().unwrap_or("Luanda, Angola");
        Self::add_centered_text(&mut operations, "F1", 7.5, y, issuer_city, page_width, (0.3, 0.3, 0.3));
        y -= 14.0;

        Self::draw_dashed_line(&mut operations, 10.0, page_width - 10.0, y);
        y -= 13.0;

        // Documento e Data
        let doc_title = match invoice.document_type.as_str() {
            "FR" => "FACTURA / RECIBO",
            "FT" => "FACTURA",
            "NC" => "NOTA DE CRÉDITO",
            "ND" => "NOTA DE DÉBITO",
            other => other,
        };

        Self::add_centered_text(&mut operations, "F2", 10.0, y, doc_title, page_width, (0.0, 0.0, 0.0));
        y -= 12.0;

        Self::add_centered_text(&mut operations, "F2", 9.0, y, &invoice.document_number, page_width, (0.0, 0.0, 0.0));
        y -= 11.0;

        let date_str = invoice.issued_at.format("%Y-%m-%d %H:%M").to_string();
        Self::add_centered_text(&mut operations, "F1", 7.5, y, &format!("Data: {} | ORIGINAL", date_str), page_width, (0.2, 0.2, 0.2));
        y -= 13.0;

        // Cliente
        Self::add_text(&mut operations, "F1", 7.5, 12.0, y, &format!("Adquirente: {}", invoice.customer_name), (0.1, 0.1, 0.1));
        y -= 10.0;
        Self::add_text(&mut operations, "F1", 7.5, 12.0, y, &format!("NIF: {}", invoice.customer_nif), (0.1, 0.1, 0.1));
        y -= 12.0;

        Self::draw_dashed_line(&mut operations, 10.0, page_width - 10.0, y);
        y -= 12.0;

        // Cabeçalho das Linhas
        Self::add_text(&mut operations, "F2", 7.0, 12.0, y, "Artigo / Qtd x Preço", (0.2, 0.2, 0.2));
        Self::add_right_text(&mut operations, "F2", 7.0, page_width - 12.0, y, "Total", (0.2, 0.2, 0.2));
        y -= 12.0;

        // Linhas de Artigos
        for line in &invoice.lines {
            let desc = if line.description.len() > 24 {
                format!("{}...", &line.description[..21])
            } else {
                line.description.clone()
            };
            Self::add_text(&mut operations, "F1", 7.5, 12.0, y, &desc, (0.0, 0.0, 0.0));
            Self::add_right_text(&mut operations, "F2", 7.5, page_width - 12.0, y, &format!("{:.2}", line.line_total), (0.0, 0.0, 0.0));
            y -= 10.0;

            let vat_detail = if line.tax_rate.is_zero() {
                "IVA 0% (Isento)".to_string()
            } else {
                format!("IVA {:.0}%", line.tax_rate)
            };
            let sub_line = format!("{:.2} x {:.2} [{}]", line.quantity, line.unit_price, vat_detail);
            Self::add_text(&mut operations, "F1", 6.5, 12.0, y, &sub_line, (0.4, 0.4, 0.4));
            y -= 11.0;
        }

        Self::draw_dashed_line(&mut operations, 10.0, page_width - 10.0, y);
        y -= 13.0;

        // Totais
        Self::add_text(&mut operations, "F1", 7.5, 12.0, y, "Total Ilíquido:", (0.2, 0.2, 0.2));
        Self::add_right_text(&mut operations, "F1", 7.5, page_width - 12.0, y, &format!("{:.2} AOA", invoice.gross_total), (0.1, 0.1, 0.1));
        y -= 11.0;

        Self::add_text(&mut operations, "F1", 7.5, 12.0, y, "Total IVA:", (0.2, 0.2, 0.2));
        Self::add_right_text(&mut operations, "F1", 7.5, page_width - 12.0, y, &format!("{:.2} AOA", invoice.tax_total), (0.1, 0.1, 0.1));
        y -= 11.0;

        if !invoice.withholding_total.is_zero() {
            Self::add_text(&mut operations, "F1", 7.5, 12.0, y, "Retenção Fonte (6.5%):", (0.5, 0.1, 0.1));
            Self::add_right_text(&mut operations, "F1", 7.5, page_width - 12.0, y, &format!("-{:.2} AOA", invoice.withholding_total), (0.5, 0.1, 0.1));
            y -= 11.0;
        }

        if !invoice.stamp_duty_total.is_zero() {
            Self::add_text(&mut operations, "F1", 7.5, 12.0, y, "Imposto de Selo:", (0.2, 0.2, 0.2));
            Self::add_right_text(&mut operations, "F1", 7.5, page_width - 12.0, y, &format!("+{:.2} AOA", invoice.stamp_duty_total), (0.1, 0.1, 0.1));
            y -= 11.0;
        }

        y -= 3.0;
        Self::add_text(&mut operations, "F2", 9.5, 12.0, y, "TOTAL A PAGAR:", (0.0, 0.0, 0.0));
        Self::add_right_text(&mut operations, "F2", 10.0, page_width - 12.0, y, &format!("{:.2} AOA", invoice.amount_due), (0.0, 0.0, 0.0));
        y -= 16.0;

        Self::draw_dashed_line(&mut operations, 10.0, page_width - 10.0, y);
        y -= 14.0;

        // Desenho do QR Code AGT Centrado
        let qr_payload = AgtQrCodeService::build_payload(invoice, software_cert);
        if let Ok(matrix) = AgtQrCodeService::generate_matrix(&qr_payload) {
            let qr_size = 75.0; // 75 pt
            let module_count = matrix.len() as f64;
            let module_size = qr_size / module_count;
            let qr_start_x = (page_width - qr_size) / 2.0;
            let qr_start_y = y - qr_size;

            operations.push(Operation::new("q", vec![]));
            operations.push(Operation::new("rg", vec![0.0.into(), 0.0.into(), 0.0.into()]));
            for (r, row) in matrix.iter().enumerate() {
                let py = qr_start_y + (module_count - 1.0 - r as f64) * module_size;
                for (c, &is_dark) in row.iter().enumerate() {
                    if is_dark {
                        let px = qr_start_x + c as f64 * module_size;
                        operations.push(Operation::new(
                            "re",
                            vec![px.into(), py.into(), module_size.into(), module_size.into()],
                        ));
                    }
                }
            }
            operations.push(Operation::new("f", vec![]));
            operations.push(Operation::new("Q", vec![]));

            y = qr_start_y - 12.0;
        }

        // Menção Legal Mandatória da AGT
        let legal_str = format!(
            "{}-Processado por programa validado",
            invoice.validation_chars
        );
        let cert_str = format!("n.º {} Kudiba ERP", software_cert);
        Self::add_centered_text(&mut operations, "F2", 7.0, y, &legal_str, page_width, (0.0, 0.0, 0.0));
        y -= 9.0;
        Self::add_centered_text(&mut operations, "F1", 7.0, y, &cert_str, page_width, (0.2, 0.2, 0.2));
        y -= 12.0;

        Self::add_centered_text(&mut operations, "F1", 6.5, y, "Obrigado pela sua preferência!", page_width, (0.4, 0.4, 0.4));

        let content = Content { operations };
        let encoded_bytes = content
            .encode()
            .map_err(|e| DomainError::invalid(format!("Erro ao codificar talão térmico PDF: {e:?}")))?;

        let content_id = doc.add_object(Stream::new(dictionary! {}, encoded_bytes));

        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });

        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), page_width.into(), page_height.into()],
        };

        doc.objects.insert(pages_id, Object::Dictionary(pages));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        doc.trailer.set("Root", catalog_id);

        let mut output = Vec::new();
        doc.save_to(&mut output)
            .map_err(|e| DomainError::invalid(format!("Erro ao gerar bytes do talão PDF: {e:?}")))?;

        Ok(output)
    }

    /// Gera a representação do talão em formato de texto para impressoras térmicas (48 colunas)
    pub fn generate_text(
        invoice: &Invoice,
        company_name: &str,
        software_cert: &str,
    ) -> Result<String, DomainError> {
        let width = 48;
        let mut out = String::new();

        out.push_str(&Self::center_text(company_name, width));
        out.push('\n');

        let issuer_nif = invoice.issuer_nif.as_deref().unwrap_or("999999999");
        out.push_str(&Self::center_text(&format!("NIF: {}", issuer_nif), width));
        out.push('\n');

        if let Some(city) = &invoice.issuer_city {
            out.push_str(&Self::center_text(city, width));
            out.push('\n');
        }

        out.push_str(&"-".repeat(width));
        out.push('\n');

        let doc_type = match invoice.document_type.as_str() {
            "FR" => "FACTURA / RECIBO",
            "FT" => "FACTURA",
            "NC" => "NOTA DE CRÉDITO",
            "ND" => "NOTA DE DÉBITO",
            other => other,
        };
        out.push_str(&Self::center_text(doc_type, width));
        out.push('\n');
        out.push_str(&Self::center_text(&invoice.document_number, width));
        out.push('\n');

        let date_str = invoice.issued_at.format("%Y-%m-%d %H:%M").to_string();
        out.push_str(&Self::center_text(&format!("Data: {} | ORIGINAL", date_str), width));
        out.push('\n');

        out.push_str(&format!("Adquirente: {}\n", invoice.customer_name));
        out.push_str(&format!("NIF: {}\n", invoice.customer_nif));
        out.push_str(&"-".repeat(width));
        out.push('\n');

        out.push_str(&format!("{:<28} {:>5} {:>13}\n", "Artigo", "Qtd", "Total"));
        out.push_str(&"-".repeat(width));
        out.push('\n');

        for line in &invoice.lines {
            let desc = if line.description.len() > 46 {
                &line.description[..46]
            } else {
                &line.description
            };
            out.push_str(&format!("{}\n", desc));
            out.push_str(&format!(
                "{:>28} {:>5.2} {:>13.2}\n",
                format!("{:.2}x", line.unit_price),
                line.quantity,
                line.line_total
            ));
        }

        out.push_str(&"-".repeat(width));
        out.push('\n');

        out.push_str(&format!("{:<30} {:>17.2} AOA\n", "Total Ilíquido:", invoice.gross_total));
        out.push_str(&format!("{:<30} {:>17.2} AOA\n", "Total IVA:", invoice.tax_total));

        if !invoice.withholding_total.is_zero() {
            out.push_str(&format!("{:<30} {:>17.2} AOA\n", "Retenção na Fonte (6.5%):", -invoice.withholding_total));
        }
        if !invoice.stamp_duty_total.is_zero() {
            out.push_str(&format!("{:<30} {:>17.2} AOA\n", "Imposto de Selo:", invoice.stamp_duty_total));
        }

        out.push_str(&"=".repeat(width));
        out.push('\n');
        out.push_str(&format!("{:<26} {:>21.2} AOA\n", "TOTAL A PAGAR:", invoice.amount_due));
        out.push_str(&"=".repeat(width));
        out.push('\n');

        // Código QR em ASCII
        let qr_payload = AgtQrCodeService::build_payload(invoice, software_cert);
        if let Ok(ascii_qr) = AgtQrCodeService::generate_ascii(&qr_payload) {
            out.push_str(&ascii_qr);
            out.push('\n');
        }

        let legal_str = format!("{}-Processado por programa validado", invoice.validation_chars);
        let cert_str = format!("n.º {} Kudiba ERP", software_cert);
        out.push_str(&Self::center_text(&legal_str, width));
        out.push('\n');
        out.push_str(&Self::center_text(&cert_str, width));
        out.push('\n');
        out.push_str(&Self::center_text("Obrigado pela preferência!", width));
        out.push('\n');

        Ok(out)
    }

    fn center_text(text: &str, width: usize) -> String {
        if text.len() >= width {
            text[..width].to_string()
        } else {
            let left_pad = (width - text.len()) / 2;
            format!("{}{}", " ".repeat(left_pad), text)
        }
    }

    fn add_text(
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

    fn add_centered_text(
        operations: &mut Vec<Operation>,
        font: &str,
        size: f64,
        y: f64,
        text: &str,
        page_width: f64,
        color: (f64, f64, f64),
    ) {
        let approx_char_width = size * 0.52;
        let text_width = text.len() as f64 * approx_char_width;
        let x = ((page_width - text_width) / 2.0).max(10.0);
        Self::add_text(operations, font, size, x, y, text, color);
    }

    fn add_right_text(
        operations: &mut Vec<Operation>,
        font: &str,
        size: f64,
        right_x: f64,
        y: f64,
        text: &str,
        color: (f64, f64, f64),
    ) {
        let approx_char_width = size * 0.55;
        let text_width = text.len() as f64 * approx_char_width;
        let x = (right_x - text_width).max(10.0);
        Self::add_text(operations, font, size, x, y, text, color);
    }

    fn draw_dashed_line(operations: &mut Vec<Operation>, x1: f64, x2: f64, y: f64) {
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("w", vec![0.5.into()]));
        operations.push(Operation::new("d", vec![vec![2.into(), 2.into()].into(), 0.into()]));
        operations.push(Operation::new("RG", vec![0.6.into(), 0.6.into(), 0.6.into()]));
        operations.push(Operation::new("m", vec![x1.into(), y.into()]));
        operations.push(Operation::new("l", vec![x2.into(), y.into()]));
        operations.push(Operation::new("S", vec![]));
        operations.push(Operation::new("Q", vec![]));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use rust_decimal::Decimal;
    use uuid::Uuid;

    use crate::domain::entities::invoice_line::InvoiceLine;

    fn sample_thermal_invoice() -> Invoice {
        let invoice_id = Uuid::new_v4();
        Invoice {
            id: invoice_id,
            tenant_id: Uuid::new_v4(),
            issuer_nif: Some("5412345678".to_string()),
            issuer_address: Some("Mutamba, Luanda".to_string()),
            issuer_city: Some("Luanda".to_string()),
            issuer_country: Some("AO".to_string()),
            series_id: Uuid::new_v4(),
            document_number: "FR KUD26/000001".to_string(),
            sequence_number: 1,
            document_type: "FR".to_string(),
            customer_name: "Consumidor Final".to_string(),
            customer_nif: "999999999".to_string(),
            customer_address: None,
            customer_city: None,
            customer_country: None,
            source_document_number: None,
            payment_methods: vec!["NUMERARIO".to_string()],
            currency: "AOA".to_string(),
            net_total: Decimal::new(250000, 2),
            tax_total: Decimal::new(35000, 2),
            gross_total: Decimal::new(285000, 2),
            withholding_total: Decimal::ZERO,
            stamp_duty_total: Decimal::new(2000, 2),
            amount_due: Decimal::new(287000, 2),
            hash_sha256: "aabbcc...".to_string(),
            signature_rsa_base64: "sig...".to_string(),
            validation_chars: "k1m4".to_string(),
            key_version: "1".to_string(),
            is_contingency: false,
            tax_regime_code: "GERAL".to_string(),
            issued_at: Utc.with_ymd_and_hms(2026, 10, 7, 12, 0, 0).unwrap(),
            system_entry_date: Utc.with_ymd_and_hms(2026, 10, 7, 12, 0, 0).unwrap(),
            created_at: Utc.with_ymd_and_hms(2026, 10, 7, 12, 0, 0).unwrap(),
            lines: vec![
                InvoiceLine::new(
                    Uuid::new_v4(),
                    invoice_id,
                    1,
                    "CAFE-01".to_string(),
                    "Café Expresso Delta".to_string(),
                    Decimal::new(200, 2),
                    Decimal::new(125000, 2),
                    Decimal::ZERO,
                    Decimal::new(1400, 2),
                    None,
                    Decimal::new(285000, 2),
                ),
            ],
            transport: None,
        }
    }

    #[test]
    fn gera_talao_termico_pdf_80mm() {
        let invoice = sample_thermal_invoice();
        let pdf = InvoiceThermalGenerator::generate_pdf(&invoice, "Pastelaria Luanda", "999/AGT/2026")
            .expect("talao termico pdf");

        assert!(!pdf.is_empty());
        assert!(pdf.starts_with(b"%PDF-1.5"));
    }

    #[test]
    fn gera_talao_termico_texto_com_qr_e_quatro_caracteres() {
        let invoice = sample_thermal_invoice();
        let text = InvoiceThermalGenerator::generate_text(&invoice, "Pastelaria Luanda", "999/AGT/2026")
            .expect("talao termico texto");

        assert!(text.contains("FR KUD26/000001"));
        assert!(text.contains("TOTAL A PAGAR:"));
        assert!(text.contains("k1m4-Processado por programa validado"));
        assert!(text.contains("n.º 999/AGT/2026 Kudiba ERP"));
    }
}
