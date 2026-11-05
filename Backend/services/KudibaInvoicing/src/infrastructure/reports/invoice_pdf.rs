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
use std::io::Read;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Encoding, Object, ObjectId, Stream, StringFormat};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;

use crate::domain::entities::invoice::Invoice;
use crate::domain::entities::invoice_line::InvoiceLine;
use crate::domain::entities::tenant::Tenant;
use crate::domain::error::DomainError;
use crate::domain::services::fiscal_qr::AgtQrCodeService;

pub struct InvoicePdfGenerator;

struct DecodedLogo {
    width: u32,
    height: u32,
    color_space: &'static str,
    data: Vec<u8>,
    filter: Option<&'static str>,
    inverted_cmyk: bool,
}

impl InvoicePdfGenerator {
    /// Produz o ficheiro binário PDF (formato A4) do documento fiscal
    #[allow(dead_code)]
    pub fn generate_pdf(
        invoice: &Invoice,
        company_name: &str,
        software_cert: &str,
    ) -> Result<Vec<u8>, DomainError> {
        Self::generate_pdf_with_tenant(invoice, None, company_name, software_cert)
    }

    pub fn generate_pdf_with_tenant(
        invoice: &Invoice,
        tenant: Option<&Tenant>,
        company_name: &str,
        software_cert: &str,
    ) -> Result<Vec<u8>, DomainError> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        // Fontes standard Type1 com codificação WinAnsi (caracteres do português)
        let font_regular_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
            "Encoding" => "WinAnsiEncoding",
        });

        let font_bold_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica-Bold",
            "Encoding" => "WinAnsiEncoding",
        });

        let font_italic_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica-Oblique",
            "Encoding" => "WinAnsiEncoding",
        });

        let logo = tenant
            .and_then(|t| t.logo_data_url.as_deref())
            .and_then(|data_url| Self::add_logo_xobject(&mut doc, data_url));

        let mut resources = dictionary! {
            "Font" => dictionary! {
                "F1" => font_regular_id,
                "F2" => font_bold_id,
                "F3" => font_italic_id,
            },
        };
        if let Some((logo_id, _, _)) = logo {
            resources.set(
                "XObject",
                dictionary! {
                    "Logo" => logo_id,
                },
            );
        }
        let resources_id = doc.add_object(resources);

        let mut operations: Vec<Operation> = vec![
            // Faixa superior decorativa de largura total (x=40..555, w=515)
            Operation::new("q", vec![]),
            Operation::new("rg", vec![0.12.into(), 0.23.into(), 0.54.into()]),
            Operation::new("re", vec![40.into(), 812.into(), 515.into(), 5.into()]),
            Operation::new("f", vec![]),
            Operation::new("Q", vec![]),
        ];

        let header_left_x = 40.0;
        let (issuer_top_y, section_shift) = if let Some((_, logo_w, logo_h)) = logo {
            let max_w = 90.0;
            let max_h = 34.0;
            let scale = (max_w / logo_w as f64).min(max_h / logo_h as f64).min(1.0);
            let draw_w = logo_w as f64 * scale;
            let draw_h = logo_h as f64 * scale;
            let logo_y = 810.0 - draw_h;

            operations.push(Operation::new("q", vec![]));
            operations.push(Operation::new(
                "cm",
                vec![
                    draw_w.into(),
                    0.into(),
                    0.into(),
                    draw_h.into(),
                    header_left_x.into(),
                    logo_y.into(),
                ],
            ));
            operations.push(Operation::new("Do", vec!["Logo".into()]));
            operations.push(Operation::new("Q", vec![]));

            let issuer_top_y = (logo_y - 14.0).min(792.0);
            (issuer_top_y, (792.0 - issuer_top_y).max(0.0))
        } else {
            (792.0, 0.0)
        };

        // =====================================================================
        // 1. TOPO & CABEÇALHO DO EMITENTE E DOCUMENTO
        // =====================================================================

        let display_title = tenant
            .and_then(|t| t.trade_name.as_deref())
            .filter(|s| !s.trim().is_empty())
            .or_else(|| tenant.map(|t| t.company_name.as_str()))
            .unwrap_or(company_name);

        // Dados do Emitente (Lado Esquerdo - Tipografia compacta com respiro central)
        Self::add_text(
            &mut operations,
            "F2",
            12.5,
            header_left_x,
            issuer_top_y,
            display_title,
            (0.1, 0.15, 0.3),
        );

        let mut header_y = issuer_top_y - 12.5;
        if let Some(t) = tenant {
            if t.trade_name
                .as_deref()
                .is_some_and(|tr| !tr.trim().is_empty() && tr.trim() != t.company_name.trim())
            {
                Self::add_text(
                    &mut operations,
                    "F2",
                    7.8,
                    header_left_x,
                    header_y,
                    &t.company_name,
                    (0.25, 0.25, 0.25),
                );
                header_y -= 10.0;
            }
        }

        let issuer_nif = invoice
            .issuer_nif
            .as_deref()
            .or_else(|| tenant.map(|t| t.nif.as_str()))
            .unwrap_or("999999999");

        let mut nif_line = format!("NIF: {}", issuer_nif);
        if let Some(reg) = tenant
            .and_then(|t| t.commercial_registry.as_deref())
            .filter(|s| !s.trim().is_empty())
        {
            nif_line.push_str(&format!(" | {}", reg));
        }
        Self::add_text(
            &mut operations,
            "F2",
            7.5,
            header_left_x,
            header_y,
            &nif_line,
            (0.2, 0.2, 0.2),
        );
        header_y -= 9.5;

        if let Some(cap) = tenant
            .and_then(|t| t.share_capital.as_deref())
            .filter(|s| !s.trim().is_empty())
        {
            Self::add_text(
                &mut operations,
                "F1",
                7.2,
                header_left_x,
                header_y,
                &format!("Capital Social: {}", cap),
                (0.35, 0.35, 0.35),
            );
            header_y -= 9.5;
        }

        let issuer_addr = invoice
            .issuer_address
            .as_deref()
            .or_else(|| tenant.and_then(|t| t.address_detail.as_deref()))
            .unwrap_or("Sede Comercial");
        let issuer_city = invoice
            .issuer_city
            .as_deref()
            .or_else(|| tenant.and_then(|t| t.city.as_deref()))
            .unwrap_or("Luanda");
        let issuer_country = invoice
            .issuer_country
            .as_deref()
            .or_else(|| tenant.and_then(|t| t.country.as_deref()))
            .unwrap_or("Angola");
        Self::add_text(
            &mut operations,
            "F1",
            7.2,
            header_left_x,
            header_y,
            &format!("{}, {} - {}", issuer_addr, issuer_city, issuer_country),
            (0.35, 0.35, 0.35),
        );
        header_y -= 9.5;

        if let Some(t) = tenant {
            let mut contacts = Vec::new();
            if let Some(p) = t.phone.as_deref().filter(|s| !s.trim().is_empty()) {
                contacts.push(format!("Tel: {}", p));
            }
            if let Some(e) = t.email.as_deref().filter(|s| !s.trim().is_empty()) {
                contacts.push(e.to_string());
            }
            if let Some(w) = t.website.as_deref().filter(|s| !s.trim().is_empty()) {
                contacts.push(w.to_string());
            }
            if !contacts.is_empty() {
                Self::add_text(
                    &mut operations,
                    "F1",
                    6.8,
                    header_left_x,
                    header_y,
                    &contacts.join(" | "),
                    (0.4, 0.4, 0.4),
                );
            }
        }

        // Tipo e Identificação do Documento (Lado Direito - alinhado à direita para criar intervalo central)
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

        Self::add_text_right(
            &mut operations,
            "F2",
            13.5,
            555.0,
            788.0,
            doc_title,
            (0.12, 0.23, 0.54),
        );
        Self::add_text_right(
            &mut operations,
            "F2",
            10.5,
            555.0,
            772.0,
            &format!("N.º {}", invoice.document_number),
            (0.1, 0.1, 0.1),
        );
        Self::add_text_right(
            &mut operations,
            "F2",
            8.0,
            555.0,
            758.0,
            "ORIGINAL",
            (0.3, 0.3, 0.3),
        );

        if invoice.is_contingency {
            Self::add_text_right(
                &mut operations,
                "F2",
                7.0,
                555.0,
                744.0,
                "EMITIDO EM MODO DE CONTINGÊNCIA FISCAL (DEC. 71/25)",
                (0.75, 0.1, 0.1),
            );
        }

        // =====================================================================
        // 2. BLOCOS DE METADADOS: ADQUIRENTE E OPERAÇÃO
        // =====================================================================
        // Caixa do Adquirente (x=40, y=650, w=250, h=75)
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new(
            "rg",
            vec![0.97.into(), 0.98.into(), 0.99.into()],
        ));
        operations.push(Operation::new(
            "re",
            vec![
                40.into(),
                (650.0 - section_shift).into(),
                250.into(),
                75.into(),
            ],
        ));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));
        Self::draw_rect_border(
            &mut operations,
            40.0,
            650.0 - section_shift,
            250.0,
            75.0,
            0.5,
            (0.85, 0.88, 0.92),
        );

        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            48.0,
            712.0 - section_shift,
            "EXMO.(S) SR.(S) / ADQUIRENTE:",
            (0.3, 0.4, 0.55),
        );
        let cust_name_display = if invoice.customer_name.chars().count() > 38 {
            format!(
                "{}...",
                invoice.customer_name.chars().take(35).collect::<String>()
            )
        } else {
            invoice.customer_name.clone()
        };
        Self::add_text(
            &mut operations,
            "F2",
            9.5,
            48.0,
            698.0 - section_shift,
            &cust_name_display,
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F1",
            9.0,
            48.0,
            684.0 - section_shift,
            &format!("NIF: {}", invoice.customer_nif),
            (0.2, 0.2, 0.2),
        );

        let cust_addr = invoice
            .customer_address
            .as_deref()
            .unwrap_or("Consumidor Final");
        let cust_city = invoice.customer_city.as_deref().unwrap_or("");
        let cust_line = if cust_city.is_empty() {
            cust_addr.to_string()
        } else {
            format!("{}, {}", cust_addr, cust_city)
        };
        let cust_line_display = if cust_line.chars().count() > 42 {
            format!("{}...", cust_line.chars().take(39).collect::<String>())
        } else {
            cust_line
        };
        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            48.0,
            670.0 - section_shift,
            &cust_line_display,
            (0.35, 0.35, 0.35),
        );

        // Caixa da Operação (x=305, y=650, w=250, h=75)
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new(
            "rg",
            vec![0.97.into(), 0.98.into(), 0.99.into()],
        ));
        operations.push(Operation::new(
            "re",
            vec![
                305.into(),
                (650.0 - section_shift).into(),
                250.into(),
                75.into(),
            ],
        ));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));
        Self::draw_rect_border(
            &mut operations,
            305.0,
            650.0 - section_shift,
            250.0,
            75.0,
            0.5,
            (0.85, 0.88, 0.92),
        );

        let issued_str = invoice.issued_at.format("%Y-%m-%d %H:%M").to_string();
        let entry_str = invoice
            .system_entry_date
            .format("%Y-%m-%d %H:%M")
            .to_string();
        let payment_str = invoice.payment_methods.join(", ");

        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            313.0,
            712.0 - section_shift,
            "DADOS DA OPERAÇÃO FISCAL:",
            (0.3, 0.4, 0.55),
        );
        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            313.0,
            698.0 - section_shift,
            &format!("Data de Emissão: {}", issued_str),
            (0.2, 0.2, 0.2),
        );
        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            313.0,
            684.0 - section_shift,
            &format!("Data do Sistema: {}", entry_str),
            (0.2, 0.2, 0.2),
        );
        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            313.0,
            670.0 - section_shift,
            &format!("Pagamento: {} | Moeda: {}", payment_str, invoice.currency),
            (0.2, 0.2, 0.2),
        );
        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            313.0,
            656.0 - section_shift,
            &format!("Regime Fiscal IVA: {}", invoice.tax_regime_code),
            (0.2, 0.2, 0.2),
        );

        if let Some(src_doc) = &invoice.source_document_number {
            Self::add_text(
                &mut operations,
                "F2",
                8.0,
                313.0,
                642.0 - section_shift,
                &format!("Doc. Rectificado: {}", src_doc),
                (0.7, 0.2, 0.2),
            );
        }

        // =====================================================================
        // 3. TABELA DE ITENS / LINHAS DA FACTURA
        // =====================================================================
        let mut y = 625.0 - section_shift;

        if let Some(transport) = &invoice.transport {
            let box_y = 598.0 - section_shift;
            operations.push(Operation::new("q", vec![]));
            operations.push(Operation::new(
                "rg",
                vec![0.97.into(), 0.98.into(), 0.99.into()],
            ));
            operations.push(Operation::new(
                "re",
                vec![40.into(), box_y.into(), 515.into(), 36.into()],
            ));
            operations.push(Operation::new("f", vec![]));
            operations.push(Operation::new("Q", vec![]));
            Self::draw_rect_border(
                &mut operations,
                40.0,
                box_y,
                515.0,
                36.0,
                0.5,
                (0.82, 0.86, 0.92),
            );

            Self::add_text(
                &mut operations,
                "F2",
                7.5,
                48.0,
                box_y + 25.0,
                "DADOS DE TRANSPORTE E CARGA (DEC. 71/25):",
                (0.2, 0.35, 0.55),
            );

            let plate = transport
                .vehicle_registration
                .as_deref()
                .unwrap_or("Não especificada");
            let load_addr = transport.load_address.as_deref().unwrap_or("—");
            let load_city = transport.load_city.as_deref().unwrap_or("");
            let load_str = if load_city.is_empty() {
                load_addr.to_string()
            } else {
                format!("{load_addr}, {load_city}")
            };

            let unload_addr = transport.unload_address.as_deref().unwrap_or("—");
            let unload_city = transport.unload_city.as_deref().unwrap_or("");
            let unload_str = if unload_city.is_empty() {
                unload_addr.to_string()
            } else {
                format!("{unload_addr}, {unload_city}")
            };

            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                48.0,
                box_y + 14.0,
                &format!("Viatura / Matrícula: {plate} | Local de Carga: {load_str}"),
                (0.2, 0.2, 0.2),
            );

            let load_time_str = transport
                .load_date_time
                .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_else(|| "—".to_string());

            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                48.0,
                box_y + 4.0,
                &format!("Início do Transporte: {load_time_str} | Local de Descarga: {unload_str}"),
                (0.2, 0.2, 0.2),
            );

            y = box_y - 18.0;
        }

        // Cabeçalho da Tabela
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new(
            "rg",
            vec![0.92.into(), 0.94.into(), 0.96.into()],
        ));
        operations.push(Operation::new(
            "re",
            vec![40.into(), (y - 4.0).into(), 515.into(), 16.into()],
        ));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 8.0, 44.0, y, "N.º", (0.1, 0.1, 0.1));
        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            65.0,
            y,
            "Código",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            130.0,
            y,
            "Descrição do Artigo / Serviço",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(&mut operations, "F2", 8.0, 290.0, y, "Qtd", (0.1, 0.1, 0.1));
        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            325.0,
            y,
            "Preço Unit.",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            395.0,
            y,
            "Desc.",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            435.0,
            y,
            "IVA (%)",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            485.0,
            y,
            "Total Líquido",
            (0.1, 0.1, 0.1),
        );

        y -= 16.0;

        let vat_breakdown = Self::build_vat_breakdown(&invoice.lines);

        for line in &invoice.lines {
            let num_str = format!("{:02}", line.line_number);
            let qty_str = Self::format_decimal_comma(line.quantity);
            let price_str = Self::format_amount(line.unit_price);
            let disc_str = if line.discount_amount.is_zero() {
                "-".to_string()
            } else {
                Self::format_amount(line.discount_amount)
            };
            let vat_str = if line.tax_rate.is_zero() {
                match &line.tax_exemption_code {
                    Some(code) => format!("0% ({})", code),
                    None => "0% (Isento)".to_string(),
                }
            } else {
                Self::format_rate(line.tax_rate)
            };
            let total_str = Self::format_amount(line.line_total);

            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                44.0,
                y,
                &num_str,
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                65.0,
                y,
                &line.product_code,
                (0.2, 0.2, 0.2),
            );

            // Truncagem de descrição longa segura para UTF-8
            let desc_display = if line.description.chars().count() > 36 {
                format!(
                    "{}...",
                    line.description.chars().take(33).collect::<String>()
                )
            } else {
                line.description.clone()
            };
            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                130.0,
                y,
                &desc_display,
                (0.1, 0.1, 0.1),
            );

            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                290.0,
                y,
                &qty_str,
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                325.0,
                y,
                &price_str,
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                395.0,
                y,
                &disc_str,
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                8.0,
                435.0,
                y,
                &vat_str,
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F2",
                8.0,
                485.0,
                y,
                &total_str,
                (0.1, 0.1, 0.1),
            );

            Self::draw_horizontal_line(&mut operations, 40.0, 555.0, y - 3.0, 0.4, (0.9, 0.9, 0.9));
            y -= 14.0;
        }

        // =====================================================================
        // 4. RESUMO DE IVA (TABELA DE INCIDÊNCIA) & TOTAIS DO DOCUMENTO
        // =====================================================================
        let summary_y = if y < 350.0 { 350.0 } else { y - 10.0 };

        // 4.1 Resumo de IVA (Lado Esquerdo: x=40 a x=310)
        Self::add_text(
            &mut operations,
            "F2",
            8.5,
            40.0,
            summary_y,
            "RESUMO DE INCIDÊNCIA DE IVA",
            (0.12, 0.23, 0.54),
        );

        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new(
            "rg",
            vec![0.94.into(), 0.95.into(), 0.97.into()],
        ));
        operations.push(Operation::new(
            "re",
            vec![40.into(), (summary_y - 15.0).into(), 270.into(), 12.into()],
        ));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(
            &mut operations,
            "F2",
            7.5,
            45.0,
            summary_y - 12.0,
            "Taxa",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            7.5,
            95.0,
            summary_y - 12.0,
            "Incidência (AOA)",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            7.5,
            175.0,
            summary_y - 12.0,
            "IVA (AOA)",
            (0.1, 0.1, 0.1),
        );
        Self::add_text(
            &mut operations,
            "F2",
            7.5,
            235.0,
            summary_y - 12.0,
            "Motivo",
            (0.1, 0.1, 0.1),
        );

        let mut vat_row_y = summary_y - 24.0;
        for (rate_cents, (base, tax, ex_code)) in &vat_breakdown {
            let rate_f = *rate_cents as f64 / 100.0;
            let rate_label = format!("{:.1}%", rate_f).replace('.', ",");
            let ex_display = ex_code.as_deref().unwrap_or("-");

            Self::add_text(
                &mut operations,
                "F1",
                7.5,
                45.0,
                vat_row_y,
                &rate_label,
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                7.5,
                95.0,
                vat_row_y,
                &Self::format_amount(*base),
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                7.5,
                175.0,
                vat_row_y,
                &Self::format_amount(*tax),
                (0.2, 0.2, 0.2),
            );
            Self::add_text(
                &mut operations,
                "F1",
                7.5,
                235.0,
                vat_row_y,
                ex_display,
                (0.2, 0.2, 0.2),
            );
            Self::draw_horizontal_line(
                &mut operations,
                40.0,
                310.0,
                vat_row_y - 2.0,
                0.3,
                (0.9, 0.9, 0.9),
            );
            vat_row_y -= 11.0;
        }

        // 4.1b Coordenadas Bancárias (IBANs da Empresa)
        if let Some(t) = tenant {
            if !t.bank_accounts.is_empty() && vat_row_y > 145.0 {
                let mut bank_y = vat_row_y - 6.0;
                Self::add_text(
                    &mut operations,
                    "F2",
                    8.0,
                    40.0,
                    bank_y,
                    "COORDENADAS BANCÁRIAS PARA PAGAMENTO:",
                    (0.12, 0.23, 0.54),
                );
                bank_y -= 11.0;
                for acc in t.bank_accounts.iter().take(4) {
                    if bank_y < 125.0 {
                        break;
                    }
                    let curr = acc.currency.as_deref().unwrap_or("AOA");
                    let bank_line = format!("• {} ({}): {}", acc.bank_name, curr, acc.iban);
                    Self::add_text(
                        &mut operations,
                        "F1",
                        7.5,
                        42.0,
                        bank_y,
                        &bank_line,
                        (0.25, 0.25, 0.25),
                    );
                    bank_y -= 10.0;
                }
            }
        }

        // 4.2 Caixa de Totais Finais (Lado Direito: x=330 a x=555)
        let total_box_top = summary_y;
        let mut tot_y = total_box_top - 2.0;
        let total_row_gap = 16.0;

        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            335.0,
            tot_y,
            "Total Ilíquido:",
            (0.3, 0.3, 0.3),
        );
        Self::add_text_right(
            &mut operations,
            "F1",
            8.5,
            552.0,
            tot_y,
            &format!("{} AOA", Self::format_amount(invoice.gross_total)),
            (0.1, 0.1, 0.1),
        );
        tot_y -= total_row_gap;

        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            335.0,
            tot_y,
            "Total Base Tributável:",
            (0.3, 0.3, 0.3),
        );
        Self::add_text_right(
            &mut operations,
            "F1",
            8.5,
            552.0,
            tot_y,
            &format!("{} AOA", Self::format_amount(invoice.net_total)),
            (0.1, 0.1, 0.1),
        );
        tot_y -= total_row_gap;

        Self::add_text(
            &mut operations,
            "F1",
            8.5,
            335.0,
            tot_y,
            "Total de IVA:",
            (0.3, 0.3, 0.3),
        );
        Self::add_text_right(
            &mut operations,
            "F1",
            8.5,
            552.0,
            tot_y,
            &format!("{} AOA", Self::format_amount(invoice.tax_total)),
            (0.1, 0.1, 0.1),
        );
        tot_y -= total_row_gap;

        if !invoice.withholding_total.is_zero() {
            Self::add_text(
                &mut operations,
                "F1",
                8.5,
                335.0,
                tot_y,
                "Retenção na Fonte (6,5%):",
                (0.6, 0.1, 0.1),
            );
            Self::add_text_right(
                &mut operations,
                "F1",
                8.5,
                552.0,
                tot_y,
                &format!("-{} AOA", Self::format_amount(invoice.withholding_total)),
                (0.6, 0.1, 0.1),
            );
            tot_y -= total_row_gap;
        }

        if !invoice.stamp_duty_total.is_zero() {
            Self::add_text(
                &mut operations,
                "F1",
                8.5,
                335.0,
                tot_y,
                "Imposto de Selo (IS):",
                (0.3, 0.3, 0.3),
            );
            Self::add_text_right(
                &mut operations,
                "F1",
                8.5,
                552.0,
                tot_y,
                &format!("+{} AOA", Self::format_amount(invoice.stamp_duty_total)),
                (0.1, 0.1, 0.1),
            );
            tot_y -= total_row_gap;
        }

        // Destaque do Total a Pagar
        tot_y -= total_row_gap / 2.0;
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new(
            "rg",
            vec![0.92.into(), 0.95.into(), 1.0.into()],
        ));
        operations.push(Operation::new(
            "re",
            vec![330.into(), (tot_y - 8.5).into(), 225.into(), 27.into()],
        ));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(
            &mut operations,
            "F2",
            10.5,
            335.0,
            tot_y,
            "TOTAL A PAGAR:",
            (0.12, 0.23, 0.54),
        );
        Self::add_text_right(
            &mut operations,
            "F2",
            11.5,
            552.0,
            tot_y,
            &format!("{} AOA", Self::format_amount(invoice.amount_due)),
            (0.12, 0.23, 0.54),
        );

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
            operations.push(Operation::new(
                "rg",
                vec![0.0.into(), 0.0.into(), 0.0.into()],
            ));
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

            let center_x = qr_start_x + qr_size / 2.0;
            let center_y = qr_start_y + qr_size / 2.0;

            let quiet_size = 17.0;
            Self::draw_rounded_rect(
                &mut operations,
                (
                    center_x - quiet_size / 2.0,
                    center_y - quiet_size / 2.0,
                    quiet_size,
                    quiet_size,
                ),
                3.0,
                (1.0, 1.0, 1.0),
                None,
            );

            let badge_size = 14.0;
            Self::draw_rounded_rect(
                &mut operations,
                (
                    center_x - badge_size / 2.0,
                    center_y - badge_size / 2.0,
                    badge_size,
                    badge_size,
                ),
                2.5,
                (0.01, 0.02, 0.09),
                Some(((0.05, 0.65, 0.45), 0.75)),
            );

            Self::add_text(
                &mut operations,
                "F2",
                9.0,
                center_x - 3.25,
                center_y - 3.25,
                "K",
                (0.99, 0.82, 0.30),
            );
        }

        // 5.2 Menção Legal Mandatória da AGT (Decreto Presidencial n.º 71/25)
        let legal_mention = if software_cert.trim().is_empty() {
            format!("{}-Software sem validação AGT", invoice.validation_chars)
        } else {
            format!(
                "{}-Processado por programa validado n.º {} Kudiba ERP",
                invoice.validation_chars, software_cert
            )
        };
        Self::add_text(
            &mut operations,
            "F2",
            8.5,
            120.0,
            78.0,
            &legal_mention,
            (0.1, 0.1, 0.1),
        );

        let footer_note = tenant
            .and_then(|t| t.invoice_footer_notes.as_deref())
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento.");

        Self::add_text(
            &mut operations,
            "F3",
            7.5,
            120.0,
            62.0,
            footer_note,
            (0.4, 0.4, 0.4),
        );

        Self::add_text(
            &mut operations,
            "F2",
            8.0,
            490.0,
            42.0,
            "Página 1 / 1",
            (0.4, 0.4, 0.4),
        );

        // Fecho do documento PDF
        let content = Content { operations };
        let encoded_bytes = content.encode().map_err(|e| {
            DomainError::invalid(format!("Erro ao codificar conteúdo da factura PDF: {e:?}"))
        })?;

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
        doc.save_to(&mut output).map_err(|e| {
            DomainError::invalid(format!("Erro ao gerar bytes da factura PDF: {e:?}"))
        })?;

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
        let encoded = Encoding::SimpleEncoding(b"WinAnsiEncoding").string_to_bytes(text);

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
        operations.push(Operation::new(
            "Tj",
            vec![Object::String(encoded, StringFormat::Literal)],
        ));
        operations.push(Operation::new("ET", vec![]));
        operations.push(Operation::new("Q", vec![]));
    }

    fn str_width_helvetica_bold(text: &str, size: f64) -> f64 {
        let mut width_em = 0.0;
        for c in text.chars() {
            let w = match c {
                ' ' => 278.0,
                '!' => 333.0,
                '"' => 474.0,
                '#' | '$' | '%' => 556.0,
                '&' => 722.0,
                '\'' => 278.0,
                '(' | ')' => 333.0,
                '*' => 389.0,
                '+' => 584.0,
                ',' | '.' => 278.0,
                '-' => 333.0,
                '/' => 278.0,
                ':' | ';' => 333.0,
                '<' | '=' | '>' => 584.0,
                '?' => 556.0,
                '@' => 737.0,
                '0'..='9' => 556.0,
                'A' | 'B' | 'C' | 'D' | 'H' | 'K' | 'N' | 'R' | 'U' => 722.0,
                'E' | 'P' | 'S' | 'V' | 'X' | 'Y' | 'Z' => 667.0,
                'F' | 'L' | 'T' => 611.0,
                'G' | 'O' | 'Q' => 778.0,
                'I' => 278.0,
                'J' => 556.0,
                'M' => 833.0,
                'W' => 944.0,
                'a' | 'c' | 'e' | 's' | 'u' | 'v' | 'x' | 'y' => 556.0,
                'b' | 'd' | 'g' | 'h' | 'n' | 'o' | 'p' | 'q' => 611.0,
                'f' | 't' => 333.0,
                'i' | 'j' | 'l' => 278.0,
                'k' => 556.0,
                'm' => 889.0,
                'r' => 389.0,
                'w' => 778.0,
                'z' => 500.0,
                'º' | 'ª' => 400.0,
                'Á' | 'À' | 'Ã' | 'Â' | 'É' | 'Ê' | 'Í' | 'Ó' | 'Õ' | 'Ô' | 'Ú' | 'Ç' => {
                    722.0
                }
                'á' | 'à' | 'ã' | 'â' | 'é' | 'ê' | 'í' | 'ó' | 'õ' | 'ô' | 'ú' | 'ç' => {
                    556.0
                }
                _ => 556.0,
            };
            width_em += w;
        }
        (width_em / 1000.0) * size
    }

    fn add_text_right(
        operations: &mut Vec<Operation>,
        font: &str,
        size: f64,
        right_x: f64,
        y: f64,
        text: &str,
        color: (f64, f64, f64),
    ) {
        let width = Self::str_width_helvetica_bold(text, size);
        let x = (right_x - width).max(305.0);
        Self::add_text(operations, font, size, x, y, text, color);
    }

    fn format_amount(value: Decimal) -> String {
        let negative = value.is_sign_negative();
        let fixed = format!("{:.2}", value.abs());
        let (integer, decimals) = fixed.split_once('.').unwrap_or((&fixed, "00"));
        let digits = integer.as_bytes();
        let mut grouped = String::with_capacity(integer.len() + integer.len() / 3);
        for (index, digit) in digits.iter().enumerate() {
            if index > 0 && (digits.len() - index) % 3 == 0 {
                grouped.push('.');
            }
            grouped.push(*digit as char);
        }

        let formatted = format!("{grouped},{decimals}");
        if negative {
            format!("-{formatted}")
        } else {
            formatted
        }
    }

    fn format_decimal_comma(value: Decimal) -> String {
        format!("{:.2}", value).replace('.', ",")
    }

    fn format_rate(value: Decimal) -> String {
        format!("{:.1}%", value).replace('.', ",")
    }

    fn vat_rate_basis_points(value: Decimal) -> i64 {
        (value * Decimal::from(100)).round().to_i64().unwrap_or(0)
    }

    fn build_vat_breakdown(
        lines: &[InvoiceLine],
    ) -> BTreeMap<i64, (Decimal, Decimal, Option<String>)> {
        let mut vat_breakdown: BTreeMap<i64, (Decimal, Decimal, Option<String>)> = BTreeMap::new();

        for line in lines {
            let rate_cents = Self::vat_rate_basis_points(line.tax_rate);
            let entry = vat_breakdown.entry(rate_cents).or_insert((
                Decimal::ZERO,
                Decimal::ZERO,
                line.tax_exemption_code.clone(),
            ));
            entry.0 += line.line_base();
            entry.1 += line.line_tax();
        }

        vat_breakdown
    }

    fn add_logo_xobject(doc: &mut Document, data_url: &str) -> Option<(ObjectId, u32, u32)> {
        let logo = Self::decode_logo(data_url)?;

        let mut dict = dictionary! {
            "Type" => "XObject",
            "Subtype" => "Image",
            "Width" => logo.width as i64,
            "Height" => logo.height as i64,
            "ColorSpace" => logo.color_space,
            "BitsPerComponent" => 8,
        };
        if let Some(filter) = logo.filter {
            dict.set("Filter", filter);
        }
        if logo.inverted_cmyk {
            dict.set(
                "Decode",
                vec![
                    1.into(),
                    0.into(),
                    1.into(),
                    0.into(),
                    1.into(),
                    0.into(),
                    1.into(),
                    0.into(),
                ],
            );
        }

        let logo_id = doc.add_object(Stream::new(dict, logo.data));
        Some((logo_id, logo.width, logo.height))
    }

    fn decode_logo(data_url: &str) -> Option<DecodedLogo> {
        let trimmed = data_url.trim();
        let payload = if let Some(rest) = trimmed.strip_prefix("data:") {
            let (meta, payload) = rest.split_once(',')?;
            if !meta.contains(";base64") {
                return None;
            }
            payload
        } else {
            trimmed
        };
        let compact: String = payload.chars().filter(|c| !c.is_whitespace()).collect();
        let bytes = BASE64.decode(compact.as_bytes()).ok()?;

        if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            let (width, height, data) = Self::decode_png_rgb(&bytes)?;
            return Some(DecodedLogo {
                width,
                height,
                color_space: "DeviceRGB",
                data,
                filter: None,
                inverted_cmyk: false,
            });
        }

        if bytes.starts_with(b"\xff\xd8") {
            let (width, height, components) = Self::parse_jpeg_header(&bytes)?;
            let (color_space, inverted_cmyk) = match components {
                1 => ("DeviceGray", false),
                4 => ("DeviceCMYK", true),
                _ => ("DeviceRGB", false),
            };
            return Some(DecodedLogo {
                width,
                height,
                color_space,
                data: bytes,
                filter: Some("DCTDecode"),
                inverted_cmyk,
            });
        }

        None
    }

    fn decode_png_rgb(bytes: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
        let mut position = 8usize;
        let mut width = 0u32;
        let mut height = 0u32;
        let mut bit_depth = 0u8;
        let mut color_type = 0u8;
        let mut interlace = 0u8;
        let mut palette: Vec<[u8; 3]> = Vec::new();
        let mut palette_alpha: Vec<u8> = Vec::new();
        let mut idat: Vec<u8> = Vec::new();

        while position + 12 <= bytes.len() {
            let length =
                u32::from_be_bytes(bytes[position..position + 4].try_into().ok()?) as usize;
            let chunk_type = &bytes[position + 4..position + 8];
            let chunk_end = position + 8 + length;
            if chunk_end + 4 > bytes.len() {
                return None;
            }
            let data = &bytes[position + 8..chunk_end];

            match chunk_type {
                b"IHDR" if data.len() >= 13 => {
                    width = u32::from_be_bytes(data[0..4].try_into().ok()?);
                    height = u32::from_be_bytes(data[4..8].try_into().ok()?);
                    bit_depth = data[8];
                    color_type = data[9];
                    interlace = data[12];
                }
                b"PLTE" => {
                    palette = data.as_chunks::<3>().0.to_vec();
                }
                b"tRNS" => palette_alpha = data.to_vec(),
                b"IDAT" => idat.extend_from_slice(data),
                b"IEND" => break,
                _ => {}
            }

            position = chunk_end + 4;
        }

        if width == 0 || height == 0 || bit_depth != 8 || interlace != 0 || idat.is_empty() {
            return None;
        }

        let channels = match color_type {
            0 => 1usize,
            2 => 3usize,
            3 => 1usize,
            4 => 2usize,
            6 => 4usize,
            _ => return None,
        };
        if color_type == 3 && palette.is_empty() {
            return None;
        }

        let mut decoder = flate2::read::ZlibDecoder::new(idat.as_slice());
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed).ok()?;

        let stride = width as usize * channels;
        if decompressed.len() < (stride + 1) * height as usize {
            return None;
        }

        let mut rows = Vec::with_capacity(stride * height as usize);
        let mut previous = vec![0u8; stride];
        let mut offset = 0usize;

        for _ in 0..height {
            let filter = decompressed[offset];
            offset += 1;
            let mut row = decompressed[offset..offset + stride].to_vec();
            offset += stride;

            for index in 0..stride {
                let left = if index >= channels {
                    row[index - channels] as i16
                } else {
                    0
                };
                let above = previous[index] as i16;
                let upper_left = if index >= channels {
                    previous[index - channels] as i16
                } else {
                    0
                };
                let value = match filter {
                    0 => row[index] as i16,
                    1 => row[index] as i16 + left,
                    2 => row[index] as i16 + above,
                    3 => row[index] as i16 + ((left + above) / 2),
                    4 => {
                        let predictor = left + above - upper_left;
                        let pa = (predictor - left).abs();
                        let pb = (predictor - above).abs();
                        let pc = (predictor - upper_left).abs();
                        let paeth = if pa <= pb && pa <= pc {
                            left
                        } else if pb <= pc {
                            above
                        } else {
                            upper_left
                        };
                        row[index] as i16 + paeth
                    }
                    _ => return None,
                };
                row[index] = value as u8;
            }

            rows.extend_from_slice(&row);
            previous = row;
        }

        let mut rgb = Vec::with_capacity(width as usize * height as usize * 3);
        for row in rows.chunks_exact(stride) {
            for pixel in row.chunks_exact(channels) {
                let (r, g, b, a) = match color_type {
                    0 => (pixel[0], pixel[0], pixel[0], 255u8),
                    2 => (pixel[0], pixel[1], pixel[2], 255u8),
                    3 => {
                        let entry = palette.get(pixel[0] as usize)?;
                        let alpha = palette_alpha.get(pixel[0] as usize).copied().unwrap_or(255);
                        (entry[0], entry[1], entry[2], alpha)
                    }
                    4 => (pixel[0], pixel[0], pixel[0], pixel[1]),
                    _ => (pixel[0], pixel[1], pixel[2], pixel[3]),
                };
                let alpha = a as u16;
                let blend = |channel: u8| -> u8 {
                    ((channel as u16 * alpha + 255 * (255 - alpha)) / 255) as u8
                };
                rgb.push(blend(r));
                rgb.push(blend(g));
                rgb.push(blend(b));
            }
        }

        Some((width, height, rgb))
    }

    fn parse_jpeg_header(bytes: &[u8]) -> Option<(u32, u32, u8)> {
        let mut position = 2usize;
        while position + 4 <= bytes.len() {
            if bytes[position] != 0xff {
                position += 1;
                continue;
            }
            let marker = bytes[position + 1];
            if marker == 0xff {
                position += 1;
                continue;
            }
            if marker == 0xd8 || marker == 0xd9 || (0xd0..=0xd7).contains(&marker) {
                position += 2;
                continue;
            }

            let length = u16::from_be_bytes([bytes[position + 2], bytes[position + 3]]) as usize;
            if length < 2 || position + 2 + length > bytes.len() {
                return None;
            }

            if matches!(
                marker,
                0xc0 | 0xc1
                    | 0xc2
                    | 0xc3
                    | 0xc5
                    | 0xc6
                    | 0xc7
                    | 0xc9
                    | 0xca
                    | 0xcb
                    | 0xcd
                    | 0xce
                    | 0xcf
            ) {
                if length < 8 {
                    return None;
                }
                let height = u16::from_be_bytes([bytes[position + 5], bytes[position + 6]]) as u32;
                let width = u16::from_be_bytes([bytes[position + 7], bytes[position + 8]]) as u32;
                let components = bytes[position + 9];
                return Some((width, height, components));
            }

            position += 2 + length;
        }

        None
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
        operations.push(Operation::new(
            "re",
            vec![x.into(), y.into(), w.into(), h.into()],
        ));
        operations.push(Operation::new("S", vec![]));
        operations.push(Operation::new("Q", vec![]));
    }

    fn draw_rounded_rect(
        operations: &mut Vec<Operation>,
        rect: (f64, f64, f64, f64),
        r: f64,
        fill_color: (f64, f64, f64),
        border: Option<((f64, f64, f64), f64)>,
    ) {
        let (x, y, w, h) = rect;
        let k = 0.55228475 * r;
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new(
            "rg",
            vec![
                fill_color.0.into(),
                fill_color.1.into(),
                fill_color.2.into(),
            ],
        ));
        if let Some(((br, bg, bb), bw)) = border {
            operations.push(Operation::new("w", vec![bw.into()]));
            operations.push(Operation::new("RG", vec![br.into(), bg.into(), bb.into()]));
        }
        operations.push(Operation::new("m", vec![(x + r).into(), y.into()]));
        operations.push(Operation::new("l", vec![(x + w - r).into(), y.into()]));
        operations.push(Operation::new(
            "c",
            vec![
                (x + w - r + k).into(),
                y.into(),
                (x + w).into(),
                (y + r - k).into(),
                (x + w).into(),
                (y + r).into(),
            ],
        ));
        operations.push(Operation::new(
            "l",
            vec![(x + w).into(), (y + h - r).into()],
        ));
        operations.push(Operation::new(
            "c",
            vec![
                (x + w).into(),
                (y + h - r + k).into(),
                (x + w - r + k).into(),
                (y + h).into(),
                (x + w - r).into(),
                (y + h).into(),
            ],
        ));
        operations.push(Operation::new("l", vec![(x + r).into(), (y + h).into()]));
        operations.push(Operation::new(
            "c",
            vec![
                (x + r - k).into(),
                (y + h).into(),
                x.into(),
                (y + h - r + k).into(),
                x.into(),
                (y + h - r).into(),
            ],
        ));
        operations.push(Operation::new("l", vec![x.into(), (y + r).into()]));
        operations.push(Operation::new(
            "c",
            vec![
                x.into(),
                (y + r - k).into(),
                (x + r - k).into(),
                y.into(),
                (x + r).into(),
                y.into(),
            ],
        ));
        operations.push(Operation::new("h", vec![]));
        if border.is_some() {
            operations.push(Operation::new("B", vec![]));
        } else {
            operations.push(Operation::new("f", vec![]));
        }
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
            cash_session_id: None,
        };

        let pdf_bytes =
            InvoicePdfGenerator::generate_pdf(&invoice, "Kudiba Tecnologia SA", "999/AGT/2026")
                .expect("PDF da factura deve ser gerado");

        assert!(!pdf_bytes.is_empty());
        assert!(pdf_bytes.starts_with(b"%PDF-1.5"));
        let tenant = Tenant {
            id: Uuid::new_v4(),
            slug: "kudiba".to_string(),
            company_name: "Kudiba Tecnologia SA".to_string(),
            trade_name: Some("Kudiba ERP".to_string()),
            nif: "5412345678".to_string(),
            address_detail: Some("Av. 4 de Fevereiro".to_string()),
            city: Some("Luanda".to_string()),
            province: Some("Luanda".to_string()),
            postal_code: None,
            country: Some("AO".to_string()),
            phone: None,
            email: None,
            website: None,
            logo_data_url: Some(
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                    .to_string(),
            ),
            alvara_number: None,
            commercial_registry: None,
            share_capital: None,
            currency: Some("AOA".to_string()),
            tax_office_code: None,
            agt_cert_number: Some("999/AGT/2026".to_string()),
            invoice_footer_notes: None,
            bank_accounts: Vec::new(),
            status: "ACTIVE".to_string(),
            tax_regime_code: "GERAL".to_string(),
            contingency_started_at: None,
        };

        let pdf_with_logo = InvoicePdfGenerator::generate_pdf_with_tenant(
            &invoice,
            Some(&tenant),
            "Kudiba Tecnologia SA",
            "999/AGT/2026",
        )
        .expect("PDF com logótipo deve ser gerado");

        assert!(pdf_with_logo
            .windows(b"/XObject".len())
            .any(|window| window == b"/XObject"));
        assert!(pdf_with_logo
            .windows(b"/Logo".len())
            .any(|window| window == b"/Logo"));
    }

    #[test]
    fn formata_montantes_no_padrao_angolano() {
        assert_eq!(
            InvoicePdfGenerator::format_amount(Decimal::new(200000000, 2)),
            "2.000.000,00"
        );
        assert_eq!(
            InvoicePdfGenerator::format_amount(Decimal::new(123456789012, 2)),
            "1.234.567.890,12"
        );
        assert_eq!(
            InvoicePdfGenerator::format_amount(Decimal::new(-5000, 2)),
            "-50,00"
        );
    }

    #[test]
    fn codifica_caracteres_portugueses_em_winansi() {
        let mut operations = Vec::new();
        InvoicePdfGenerator::add_text(
            &mut operations,
            "F1",
            9.0,
            40.0,
            700.0,
            "Café à Ação — N.º 1",
            (0.0, 0.0, 0.0),
        );

        let encoded = Content { operations }.encode().expect("conteúdo válido");
        for byte in [0xe9, 0xe0, 0xe7, 0xe3, 0x97, 0xba] {
            assert!(encoded.contains(&byte), "byte WinAnsi em falta: {byte:#x}");
        }
        assert!(!encoded.windows(2).any(|window| window == [0xc3, 0xa9]));
    }

    #[test]
    fn separa_resumo_iva_por_taxa() {
        use rust_decimal::Decimal;

        let invoice_id = Uuid::new_v4();
        let lines = vec![
            InvoiceLine::new(
                Uuid::new_v4(),
                invoice_id,
                1,
                "PROD-004".to_string(),
                "Açúcar Branco Kudiba 1Kg".to_string(),
                Decimal::new(200, 2),
                Decimal::new(110000, 2),
                Decimal::ZERO,
                Decimal::ZERO,
                Some("M04".to_string()),
                Decimal::new(220000, 2),
            ),
            InvoiceLine::new(
                Uuid::new_v4(),
                invoice_id,
                2,
                "PRD-005".to_string(),
                "Computador Portátil HP ProBook".to_string(),
                Decimal::new(700, 2),
                Decimal::new(45000000, 2),
                Decimal::ZERO,
                Decimal::new(1400, 2),
                None,
                Decimal::new(359100000, 2),
            ),
        ];

        let breakdown = InvoicePdfGenerator::build_vat_breakdown(&lines);
        assert_eq!(breakdown.len(), 2);
        let (base_zero, tax_zero, code_zero) = breakdown.get(&0).expect("taxa 0%");
        assert_eq!(*base_zero, Decimal::new(220000, 2));
        assert_eq!(*tax_zero, Decimal::ZERO);
        assert_eq!(code_zero.as_deref(), Some("M04"));
        let (base_14, tax_14, code_14) = breakdown.get(&1400).expect("taxa 14%");
        assert_eq!(*base_14, Decimal::new(315000000, 2));
        assert_eq!(*tax_14, Decimal::new(44100000, 2));
        assert!(code_14.is_none());
    }

    #[test]
    fn agrupa_iva_pela_taxa_correta() {
        use rust_decimal::Decimal;

        assert_eq!(
            InvoicePdfGenerator::vat_rate_basis_points(Decimal::new(1400, 2)),
            1400
        );
        assert_eq!(
            InvoicePdfGenerator::vat_rate_basis_points(Decimal::new(0, 2)),
            0
        );
        assert_eq!(
            InvoicePdfGenerator::vat_rate_basis_points(Decimal::new(650, 2)),
            650
        );
        assert_eq!(
            InvoicePdfGenerator::format_rate(Decimal::new(1400, 2)),
            "14,0%"
        );
    }

    #[test]
    fn descodifica_logo_png_em_data_url() {
        let data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        let logo = InvoicePdfGenerator::decode_logo(data_url).expect("logo PNG válido");

        assert_eq!((logo.width, logo.height), (1, 1));
        assert_eq!(logo.color_space, "DeviceRGB");
        assert_eq!(logo.data.len(), 3);
        assert!(logo.filter.is_none());
        assert!(!logo.inverted_cmyk);
    }

    #[test]
    fn gera_pdf_fr_2026a_000001_corrigida() {
        let invoice_id = Uuid::new_v4();
        let tenant_id = Uuid::new_v4();
        let series_id = Uuid::new_v4();

        // Linha com IVA 14% do Regime Geral (ou se isento, M02 com menção legal)
        let lines = vec![InvoiceLine::new(
            Uuid::new_v4(),
            invoice_id,
            1,
            "PRD-001".to_string(),
            "Resma de Papel A4 80g (500 folhas)".to_string(),
            Decimal::new(300, 2),
            Decimal::new(2400000, 2),
            Decimal::ZERO,
            Decimal::new(1400, 2),
            None,
            Decimal::new(8208000, 2),
        )];

        let invoice = Invoice {
            id: invoice_id,
            tenant_id,
            issuer_nif: Some("5417089123".to_string()),
            issuer_address: Some(
                "Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7.º Andar".to_string(),
            ),
            issuer_city: Some("Luanda".to_string()),
            issuer_country: Some("Angola".to_string()),
            series_id,
            document_number: "FR 2026A/000001".to_string(),
            sequence_number: 1,
            document_type: "FR".to_string(),
            customer_name: "Gráfica Monalisa, Lda".to_string(),
            customer_nif: "5000012000".to_string(),
            customer_address: Some("Pólo Industrial de Viana, Rua Principal, Lote 12".to_string()),
            customer_city: Some("Luanda".to_string()),
            customer_country: Some("AO".to_string()),
            source_document_number: None,
            payment_methods: vec!["TRANSFERENCIA".to_string()],
            currency: "AOA".to_string(),
            net_total: Decimal::new(7200000, 2),
            tax_total: Decimal::new(1008000, 2),
            gross_total: Decimal::new(8208000, 2),
            withholding_total: Decimal::ZERO,
            stamp_duty_total: Decimal::ZERO,
            amount_due: Decimal::new(8208000, 2),
            hash_sha256: "0372d6937bedfba24c747fc99f798811e5f8a02a4b89c31fa64821a73e6a".to_string(),
            signature_rsa_base64: "XoM5kL89...".to_string(),
            validation_chars: "XoM5".to_string(),
            key_version: "1".to_string(),
            is_contingency: false,
            tax_regime_code: "REGIME_GERAL".to_string(),
            issued_at: Utc.with_ymd_and_hms(2026, 10, 29, 7, 52, 0).unwrap(),
            system_entry_date: Utc.with_ymd_and_hms(2026, 10, 29, 7, 52, 0).unwrap(),
            created_at: Utc.with_ymd_and_hms(2026, 10, 29, 7, 52, 0).unwrap(),
            lines,
            transport: None,
            cash_session_id: None,
        };

        let tenant = Tenant {
            id: tenant_id,
            slug: "kudiba".to_string(),
            company_name: "Kudiba Tecnologia, S.A.".to_string(),
            trade_name: Some("Kudiba ERP".to_string()),
            nif: "5417089123".to_string(),
            alvara_number: Some("ALV-2026/00412".to_string()),
            commercial_registry: Some("CRC Luanda n.º 2026-00412".to_string()),
            share_capital: Some("2.000.000,00 Kz".to_string()),
            address_detail: Some(
                "Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7.º Andar".to_string(),
            ),
            city: Some("Luanda".to_string()),
            province: Some("Luanda".to_string()),
            postal_code: None,
            country: Some("Angola".to_string()),
            phone: Some("+244 923 000 000".to_string()),
            email: Some("geral@kudiba.ao".to_string()),
            website: Some("https://kudiba.ao".to_string()),
            logo_data_url: None,
            currency: Some("AOA".to_string()),
            tax_office_code: Some("01".to_string()),
            agt_cert_number: Some("FE/528/AGT/2026".to_string()),
            invoice_footer_notes: None,
            bank_accounts: vec![],
            status: "ACTIVE".to_string(),
            tax_regime_code: "GERAL".to_string(),
            contingency_started_at: None,
        };

        let pdf = InvoicePdfGenerator::generate_pdf_with_tenant(
            &invoice,
            Some(&tenant),
            &tenant.company_name,
            "FE/528/AGT/2026",
        )
        .expect("PDF corrigido deve ser gerado");

        let out_path = "/home/jaime.coxi@hssa.local/Transferências/FR 2026A_000001_CORRIGIDA.pdf";
        std::fs::write(out_path, &pdf).expect("Deve gravar PDF corrigido");
        assert!(std::path::Path::new(out_path).exists());
    }
}
