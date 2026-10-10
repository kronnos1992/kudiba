//! Gerador de Facturas e Documentos Fiscais em Formato PDF Oficial (A4)
//!
//! Em estrita conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas)
//! e directrizes da Administração Geral Tributária (AGT) de Angola.
//!
//! Inclui:
//! - Layout oficial completo (Emitente, Adquirente, Linhas, Resumo de IVA, Totais)
//! - QR Code vetorial nativo da AGT gravado diretamente nas operações do PDF
//! - Menção legal obrigatória: "{validation_chars}-Processado por programa validado n.º {cert} Kudiba ERP"

use std::collections::BTreeMap;

use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};
use rust_decimal::Decimal;

use crate::domain::entities::invoice::Invoice;
use crate::domain::error::DomainError;
use crate::domain::services::fiscal_qr::AgtQrCodeService;

pub struct InvoicePdfGenerator;

impl InvoicePdfGenerator {
    /// Produz o ficheiro binário PDF (formato A4) do documento fiscal
    pub fn generate_pdf(
        invoice: &Invoice,
        company_name: &str,
        software_cert: &str,
    ) -> Result<Vec<u8>, DomainError> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        // Fontes standard Type1 (sem ficheiros de fontes externos)
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

        let font_italic_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica-Oblique",
        });

        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_regular_id,
                "F2" => font_bold_id,
                "F3" => font_italic_id,
            },
        });

        let mut operations: Vec<Operation> = Vec::new();

        // =====================================================================
        // 1. TOPO & CABEÇALHO DO EMITENTE E DOCUMENTO
        // =====================================================================
        // Faixa superior decorativa subtil (Azul Marinho #1E3A8A)
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.12.into(), 0.23.into(), 0.54.into()]));
        operations.push(Operation::new("re", vec![40.into(), 812.into(), 515.into(), 6.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        // Dados do Emitente (Lado Esquerdo)
        Self::add_text(&mut operations, "F2", 15.0, 40.0, 788.0, company_name, (0.1, 0.15, 0.3));

        let issuer_nif = invoice.issuer_nif.as_deref().unwrap_or("999999999");
        Self::add_text(&mut operations, "F2", 9.5, 40.0, 772.0, &format!("NIF: {}", issuer_nif), (0.2, 0.2, 0.2));

        let issuer_addr = invoice.issuer_address.as_deref().unwrap_or("Sede Comercial");
        let issuer_city = invoice.issuer_city.as_deref().unwrap_or("Luanda");
        let issuer_country = invoice.issuer_country.as_deref().unwrap_or("Angola");
        Self::add_text(&mut operations, "F1", 8.5, 40.0, 758.0, &format!("{}, {}", issuer_addr, issuer_city), (0.35, 0.35, 0.35));
        Self::add_text(&mut operations, "F1", 8.5, 40.0, 746.0, issuer_country, (0.35, 0.35, 0.35));

        // Tipo e Identificação do Documento (Lado Direito)
        let doc_title = match invoice.document_type.as_str() {
            "FT" => "FACTURA",
            "FR" => "FACTURA / RECIBO",
            "NC" => "NOTA DE CRÉDITO",
            "ND" => "NOTA DE DÉBITO",
            "FP" => "FACTURA PROFORMA",
            "GT" => "GUIA DE TRANSPORTE",
            "GR" => "GUIA DE REMESSA",
            other => other,
        };

        Self::add_text(&mut operations, "F2", 16.0, 340.0, 788.0, doc_title, (0.12, 0.23, 0.54));
        Self::add_text(&mut operations, "F2", 12.0, 340.0, 770.0, &format!("N.º {}", invoice.document_number), (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 340.0, 754.0, "ORIGINAL", (0.3, 0.3, 0.3));

        if invoice.is_contingency {
            Self::add_text(&mut operations, "F2", 8.0, 340.0, 740.0, "EMITIDO EM MODO DE CONTINGÊNCIA FISCAL (DEC. 71/25)", (0.75, 0.1, 0.1));
        }

        // =====================================================================
        // 2. BLOCOS DE METADADOS: ADQUIRENTE E OPERAÇÃO
        // =====================================================================
        // Caixa do Adquirente (x=40, y=650, w=250, h=75)
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.97.into(), 0.98.into(), 0.99.into()]));
        operations.push(Operation::new("re", vec![40.into(), 650.into(), 250.into(), 75.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));
        Self::draw_rect_border(&mut operations, 40.0, 650.0, 250.0, 75.0, 0.5, (0.85, 0.88, 0.92));

        Self::add_text(&mut operations, "F2", 8.0, 48.0, 712.0, "EXMO.(S) SR.(S) / ADQUIRENTE:", (0.3, 0.4, 0.55));
        Self::add_text(&mut operations, "F2", 9.5, 48.0, 698.0, &invoice.customer_name, (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F1", 9.0, 48.0, 684.0, &format!("NIF: {}", invoice.customer_nif), (0.2, 0.2, 0.2));

        let cust_addr = invoice.customer_address.as_deref().unwrap_or("Consumidor Final");
        let cust_city = invoice.customer_city.as_deref().unwrap_or("");
        let cust_line = if cust_city.is_empty() {
            cust_addr.to_string()
        } else {
            format!("{}, {}", cust_addr, cust_city)
        };
        Self::add_text(&mut operations, "F1", 8.5, 48.0, 670.0, &cust_line, (0.35, 0.35, 0.35));

        // Caixa da Operação (x=305, y=650, w=250, h=75)
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.97.into(), 0.98.into(), 0.99.into()]));
        operations.push(Operation::new("re", vec![305.into(), 650.into(), 250.into(), 75.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));
        Self::draw_rect_border(&mut operations, 305.0, 650.0, 250.0, 75.0, 0.5, (0.85, 0.88, 0.92));

        let issued_str = invoice.issued_at.format("%Y-%m-%d %H:%M").to_string();
        let entry_str = invoice.system_entry_date.format("%Y-%m-%d %H:%M").to_string();
        let payment_str = invoice.payment_methods.join(", ");

        Self::add_text(&mut operations, "F2", 8.0, 313.0, 712.0, "DADOS DA OPERAÇÃO FISCAL:", (0.3, 0.4, 0.55));
        Self::add_text(&mut operations, "F1", 8.5, 313.0, 698.0, &format!("Data de Emissão: {}", issued_str), (0.2, 0.2, 0.2));
        Self::add_text(&mut operations, "F1", 8.5, 313.0, 684.0, &format!("Data do Sistema: {}", entry_str), (0.2, 0.2, 0.2));
        Self::add_text(&mut operations, "F1", 8.5, 313.0, 670.0, &format!("Pagamento: {} | Moeda: {}", payment_str, invoice.currency), (0.2, 0.2, 0.2));
        Self::add_text(&mut operations, "F1", 8.5, 313.0, 656.0, &format!("Regime Fiscal IVA: {}", invoice.tax_regime_code), (0.2, 0.2, 0.2));

        if let Some(src_doc) = &invoice.source_document_number {
            Self::add_text(&mut operations, "F2", 8.0, 313.0, 642.0, &format!("Doc. Rectificado: {}", src_doc), (0.7, 0.2, 0.2));
        }

        // =====================================================================
        // 3. TABELA DE ITENS / LINHAS DA FACTURA
        // =====================================================================
        let mut y = 625.0;

        // Cabeçalho da Tabela
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.92.into(), 0.94.into(), 0.96.into()]));
        operations.push(Operation::new("re", vec![40.into(), (y - 4.0).into(), 515.into(), 16.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 8.0, 44.0, y, "N.º", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 65.0, y, "Código", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 130.0, y, "Descrição do Artigo / Serviço", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 290.0, y, "Qtd", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 325.0, y, "Preço Unit.", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 395.0, y, "Desc.", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 435.0, y, "IVA (%)", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 8.0, 485.0, y, "Total Líquido", (0.1, 0.1, 0.1));

        y -= 16.0;

        // Agrupador para resumo de IVA
        let mut vat_breakdown: BTreeMap<i64, (Decimal, Decimal, Option<String>)> = BTreeMap::new();

        for line in &invoice.lines {
            // Registo para resumo de IVA
            let rate_cents = (line.tax_rate * Decimal::from(100)).to_string().parse::<i64>().unwrap_or(0);
            let entry = vat_breakdown.entry(rate_cents).or_insert((Decimal::ZERO, Decimal::ZERO, line.tax_exemption_code.clone()));
            entry.0 += line.line_base();
            entry.1 += line.line_tax();

            let num_str = format!("{:02}", line.line_number);
            let qty_str = format!("{:.2}", line.quantity);
            let price_str = format!("{:.2}", line.unit_price);
            let disc_str = if line.discount_amount.is_zero() {
                "-".to_string()
            } else {
                format!("{:.2}", line.discount_amount)
            };
            let vat_str = if line.tax_rate.is_zero() {
                match &line.tax_exemption_code {
                    Some(code) => format!("0% ({})", code),
                    None => "0% (Isento)".to_string(),
                }
            } else {
                format!("{:.1}%", line.tax_rate)
            };
            let total_str = format!("{:.2}", line.line_total);

            Self::add_text(&mut operations, "F1", 8.0, 44.0, y, &num_str, (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 8.0, 65.0, y, &line.product_code, (0.2, 0.2, 0.2));

            // Truncagem de descrição longa
            let desc_display = if line.description.len() > 36 {
                format!("{}...", &line.description[..33])
            } else {
                line.description.clone()
            };
            Self::add_text(&mut operations, "F1", 8.0, 130.0, y, &desc_display, (0.1, 0.1, 0.1));

            Self::add_text(&mut operations, "F1", 8.0, 290.0, y, &qty_str, (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 8.0, 325.0, y, &price_str, (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 8.0, 395.0, y, &disc_str, (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 8.0, 435.0, y, &vat_str, (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F2", 8.0, 485.0, y, &total_str, (0.1, 0.1, 0.1));

            Self::draw_horizontal_line(&mut operations, 40.0, 555.0, y - 3.0, 0.4, (0.9, 0.9, 0.9));
            y -= 14.0;
        }

        // =====================================================================
        // 4. RESUMO DE IVA (TABELA DE INCIDÊNCIA) & TOTAIS DO DOCUMENTO
        // =====================================================================
        let summary_y = if y < 350.0 { 350.0 } else { y - 10.0 };

        // 4.1 Resumo de IVA (Lado Esquerdo: x=40 a x=310)
        Self::add_text(&mut operations, "F2", 8.5, 40.0, summary_y, "RESUMO DE INCIDÊNCIA DE IVA", (0.12, 0.23, 0.54));

        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.94.into(), 0.95.into(), 0.97.into()]));
        operations.push(Operation::new("re", vec![40.into(), (summary_y - 15.0).into(), 270.into(), 12.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 7.5, 45.0, summary_y - 12.0, "Taxa", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 7.5, 95.0, summary_y - 12.0, "Incidência (AOA)", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 7.5, 175.0, summary_y - 12.0, "IVA (AOA)", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 7.5, 235.0, summary_y - 12.0, "Motivo", (0.1, 0.1, 0.1));

        let mut vat_row_y = summary_y - 24.0;
        for (rate_cents, (base, tax, ex_code)) in &vat_breakdown {
            let rate_f = *rate_cents as f64 / 100.0;
            let rate_label = format!("{:.1}%", rate_f);
            let ex_display = ex_code.as_deref().unwrap_or("-");

            Self::add_text(&mut operations, "F1", 7.5, 45.0, vat_row_y, &rate_label, (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 7.5, 95.0, vat_row_y, &format!("{:.2}", base), (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 7.5, 175.0, vat_row_y, &format!("{:.2}", tax), (0.2, 0.2, 0.2));
            Self::add_text(&mut operations, "F1", 7.5, 235.0, vat_row_y, ex_display, (0.2, 0.2, 0.2));
            Self::draw_horizontal_line(&mut operations, 40.0, 310.0, vat_row_y - 2.0, 0.3, (0.9, 0.9, 0.9));
            vat_row_y -= 11.0;
        }

        // 4.2 Caixa de Totais Finais (Lado Direito: x=330 a x=555)
        let total_box_top = summary_y;
        let mut tot_y = total_box_top - 2.0;

        Self::add_text(&mut operations, "F1", 8.5, 335.0, tot_y, "Total Ilíquido:", (0.3, 0.3, 0.3));
        Self::add_text(&mut operations, "F1", 8.5, 475.0, tot_y, &format!("{:.2} AOA", invoice.gross_total), (0.1, 0.1, 0.1));
        tot_y -= 13.0;

        Self::add_text(&mut operations, "F1", 8.5, 335.0, tot_y, "Total Base Tributável (Incidência):", (0.3, 0.3, 0.3));
        Self::add_text(&mut operations, "F1", 8.5, 475.0, tot_y, &format!("{:.2} AOA", invoice.net_total), (0.1, 0.1, 0.1));
        tot_y -= 13.0;

        Self::add_text(&mut operations, "F1", 8.5, 335.0, tot_y, "Total Imposto sobre Valor Acrescentado:", (0.3, 0.3, 0.3));
        Self::add_text(&mut operations, "F1", 8.5, 475.0, tot_y, &format!("{:.2} AOA", invoice.tax_total), (0.1, 0.1, 0.1));
        tot_y -= 13.0;

        if !invoice.withholding_total.is_zero() {
            Self::add_text(&mut operations, "F1", 8.5, 335.0, tot_y, "Retenção na Fonte (RF 6.5%):", (0.6, 0.1, 0.1));
            Self::add_text(&mut operations, "F1", 8.5, 475.0, tot_y, &format!("-{:.2} AOA", invoice.withholding_total), (0.6, 0.1, 0.1));
            tot_y -= 13.0;
        }

        if !invoice.stamp_duty_total.is_zero() {
            Self::add_text(&mut operations, "F1", 8.5, 335.0, tot_y, "Imposto de Selo (IS):", (0.3, 0.3, 0.3));
            Self::add_text(&mut operations, "F1", 8.5, 475.0, tot_y, &format!("+{:.2} AOA", invoice.stamp_duty_total), (0.1, 0.1, 0.1));
            tot_y -= 13.0;
        }

        // Destaque do Total a Pagar
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.92.into(), 0.95.into(), 1.0.into()]));
        operations.push(Operation::new("re", vec![330.into(), (tot_y - 6.0).into(), 225.into(), 20.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 10.5, 335.0, tot_y, "TOTAL A PAGAR:", (0.12, 0.23, 0.54));
        Self::add_text(&mut operations, "F2", 11.5, 465.0, tot_y, &format!("{:.2} AOA", invoice.amount_due), (0.12, 0.23, 0.54));

        // =====================================================================
        // 5. RODAPÉ LEGAL, QR CODE DA AGT E VALIDAÇÃO FISCAL
        // =====================================================================
        Self::draw_horizontal_line(&mut operations, 40.0, 555.0, 115.0, 0.8, (0.8, 0.8, 0.8));

        // 5.1 Geração e Desenho do QR Code AGT (Vetor Nativo no PDF)
        let qr_payload = AgtQrCodeService::build_payload(invoice, software_cert);
        if let Ok(matrix) = AgtQrCodeService::generate_matrix(&qr_payload) {
            let qr_size = 65.0; // 65 pt (~2.3 cm)
            let module_count = matrix.len() as f64;
            let module_size = qr_size / module_count;
            let qr_start_x = 42.0;
            let qr_start_y = 36.0;

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
        }

        // 5.2 Menção Legal Mandatória da AGT (Decreto Presidencial n.º 71/25)
        let legal_mention = format!(
            "{}-Processado por programa validado n.º {} Kudiba ERP",
            invoice.validation_chars, software_cert
        );
        Self::add_text(&mut operations, "F2", 8.5, 120.0, 96.0, &legal_mention, (0.1, 0.1, 0.1));

        let hash_prefix = if invoice.hash_sha256.len() > 32 {
            &invoice.hash_sha256[..32]
        } else {
            &invoice.hash_sha256
        };
        let audit_line = format!(
            "Assinatura RSA-2048 PKCS#1 v1.5 (Chave v{}) | Hash: {}...",
            invoice.key_version, hash_prefix
        );
        Self::add_text(&mut operations, "F1", 7.5, 120.0, 83.0, &audit_line, (0.35, 0.35, 0.35));

        Self::add_text(
            &mut operations,
            "F3",
            7.0,
            120.0,
            70.0,
            "Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento.",
            (0.4, 0.4, 0.4),
        );

        Self::add_text(
            &mut operations,
            "F1",
            7.0,
            120.0,
            57.0,
            "Kudiba Fiscal Core — Motor de Facturação Certificado de Angola | https://kudiba.ao",
            (0.5, 0.5, 0.5),
        );

        Self::add_text(&mut operations, "F2", 8.0, 490.0, 42.0, "Página 1 / 1", (0.4, 0.4, 0.4));

        // Fecho do documento PDF
        let content = Content { operations };
        let encoded_bytes = content
            .encode()
            .map_err(|e| DomainError::invalid(format!("Erro ao codificar conteúdo da factura PDF: {e:?}")))?;

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
            "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()], // Formato A4
        };

        doc.objects.insert(pages_id, Object::Dictionary(pages));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        doc.trailer.set("Root", catalog_id);

        let mut output = Vec::new();
        doc.save_to(&mut output)
            .map_err(|e| DomainError::invalid(format!("Erro ao gerar bytes da factura PDF: {e:?}")))?;

        Ok(output)
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
        operations.push(Operation::new(
            "rg",
            vec![color.0.into(), color.1.into(), color.2.into()],
        ));
        operations.push(Operation::new(
            "Tf",
            vec![font.to_string().into(), size.into()],
        ));
        operations.push(Operation::new("Td", vec![x.into(), y.into()]));
        operations.push(Operation::new("Tj", vec![Object::string_literal(text)]));
        operations.push(Operation::new("ET", vec![]));
        operations.push(Operation::new("Q", vec![]));
    }

    fn draw_horizontal_line(
        operations: &mut Vec<Operation>,
        x1: f64,
        x2: f64,
        y: f64,
        width: f64,
        color: (f64, f64, f64),
    ) {
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("w", vec![width.into()]));
        operations.push(Operation::new(
            "RG",
            vec![color.0.into(), color.1.into(), color.2.into()],
        ));
        operations.push(Operation::new("m", vec![x1.into(), y.into()]));
        operations.push(Operation::new("l", vec![x2.into(), y.into()]));
        operations.push(Operation::new("S", vec![]));
        operations.push(Operation::new("Q", vec![]));
    }

    fn draw_rect_border(
        operations: &mut Vec<Operation>,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        width: f64,
        color: (f64, f64, f64),
    ) {
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("w", vec![width.into()]));
        operations.push(Operation::new(
            "RG",
            vec![color.0.into(), color.1.into(), color.2.into()],
        ));
        operations.push(Operation::new("re", vec![x.into(), y.into(), w.into(), h.into()]));
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

    #[test]
    fn gera_fatura_pdf_a4_com_qr_code_e_linhas() {
        let invoice_id = Uuid::new_v4();
        let lines = vec![
            InvoiceLine::new(
                Uuid::new_v4(),
                invoice_id,
                1,
                "SERV-01".to_string(),
                "Desenvolvimento e Licenciamento Kudiba".to_string(),
                Decimal::new(100, 2),
                Decimal::new(50000000, 2),
                Decimal::ZERO,
                Decimal::new(1400, 2),
                None,
                Decimal::new(57000000, 2),
            ),
            InvoiceLine::new(
                Uuid::new_v4(),
                invoice_id,
                2,
                "LIVRO-01".to_string(),
                "Manuais de Formação Fiscal".to_string(),
                Decimal::new(500, 2),
                Decimal::new(1000000, 2),
                Decimal::new(500000, 2),
                Decimal::ZERO,
                Some("M02".to_string()),
                Decimal::new(4500000, 2),
            ),
        ];

        let invoice = Invoice {
            id: invoice_id,
            tenant_id: Uuid::new_v4(),
            issuer_nif: Some("5412345678".to_string()),
            issuer_address: Some("Av. 4 de Fevereiro, Luanda".to_string()),
            issuer_city: Some("Luanda".to_string()),
            issuer_country: Some("Angola".to_string()),
            series_id: Uuid::new_v4(),
            document_number: "FT KUD26/000010".to_string(),
            sequence_number: 10,
            document_type: "FT".to_string(),
            customer_name: "Sonangol EP".to_string(),
            customer_nif: "5400000001".to_string(),
            customer_address: Some("Rua da Alfândega".to_string()),
            customer_city: Some("Luanda".to_string()),
            customer_country: Some("AO".to_string()),
            source_document_number: None,
            payment_methods: vec!["TRANSFERENCIA".to_string()],
            currency: "AOA".to_string(),
            net_total: Decimal::new(54500000, 2),
            tax_total: Decimal::new(7000000, 2),
            gross_total: Decimal::new(61500000, 2),
            withholding_total: Decimal::new(3250000, 2),
            stamp_duty_total: Decimal::ZERO,
            amount_due: Decimal::new(58250000, 2),
            hash_sha256: "7b4c6e...".to_string(),
            signature_rsa_base64: "aBcD...".to_string(),
            validation_chars: "x9y2".to_string(),
            key_version: "1".to_string(),
            is_contingency: false,
            tax_regime_code: "GERAL".to_string(),
            issued_at: Utc.with_ymd_and_hms(2026, 10, 7, 10, 0, 0).unwrap(),
            system_entry_date: Utc.with_ymd_and_hms(2026, 10, 7, 10, 0, 0).unwrap(),
            created_at: Utc.with_ymd_and_hms(2026, 10, 7, 10, 0, 0).unwrap(),
            lines,
            transport: None,
        };

        let pdf_bytes = InvoicePdfGenerator::generate_pdf(
            &invoice,
            "Kudiba Tecnologia SA",
            "999/AGT/2026",
        )
        .expect("PDF da factura deve ser gerado");

        assert!(!pdf_bytes.is_empty());
        assert!(pdf_bytes.starts_with(b"%PDF-1.5"));
    }
}
