//! Gerador de Relatórios Fiscais em Formato PDF Oficial (A4)
//!
//! Em conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas)
//! e o Código Geral Tributário de Angola.

use chrono::Utc;
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};
use rust_decimal::Decimal;

use crate::application::queries::fiscal_reports::FiscalReportResult;
use crate::domain::error::DomainError;

pub struct TaxPdfReportGenerator;

impl TaxPdfReportGenerator {
    /// Produz o ficheiro binário PDF (formato A4) do mapa fiscal de IVA e retenções
    pub fn generate_pdf(report: &FiscalReportResult) -> Result<Vec<u8>, DomainError> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        // Fontes standard Type1 (sem dependência de ficheiros externos de fontes)
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

        // 1. Cabeçalho Visual & Barra decorativa superior (Azul Marinho #1E3A8A)
        // Retângulo azul de topo: x=40, y=795, w=515, h=25
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.12.into(), 0.23.into(), 0.54.into()]));
        operations.push(Operation::new("re", vec![40.into(), 795.into(), 515.into(), 25.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        // Título dentro da barra
        Self::add_text(&mut operations, "F2", 13.0, 48.0, 804.0, "KUDIBA ERP - MAPA DE APURAMENTO FISCAL E IVA", (1.0, 1.0, 1.0));

        // Subtítulo e Metadados do Emitente
        Self::add_text(&mut operations, "F1", 9.0, 40.0, 778.0, "Regime Juridico das Facturas e Documentos Equivalentes (Decreto Presidencial n. 71/25)", (0.3, 0.3, 0.3));

        let period_desc = match report.fiscal_month {
            Some(m) => format!("Periodo Fiscal: Mes {:02} / Exercicio {}", m, report.fiscal_year),
            None => format!("Periodo Fiscal: Exercicio Anual {}", report.fiscal_year),
        };
        Self::add_text(&mut operations, "F2", 10.0, 40.0, 755.0, &period_desc, (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F1", 9.0, 320.0, 755.0, &format!("Tenant ID: {}", report.tenant_id), (0.2, 0.2, 0.2));
        Self::add_text(&mut operations, "F1", 9.0, 40.0, 740.0, "Moeda Padrao: Kwanzas (AOA) | Base de Incidencia: Facturacao Liquida", (0.2, 0.2, 0.2));

        let emission_date = Utc::now().format("Emitido em: %Y-%m-%d %H:%M:%S UTC").to_string();
        Self::add_text(&mut operations, "F1", 8.0, 320.0, 740.0, &emission_date, (0.4, 0.4, 0.4));

        // 2. Seccao 1: Incidência e Apuramento de IVA
        // Linha separadora
        Self::draw_horizontal_line(&mut operations, 40.0, 555.0, 728.0, 1.0, (0.8, 0.8, 0.8));

        Self::add_text(&mut operations, "F2", 11.0, 40.0, 712.0, "1. Incidencia de Imposto sobre o Valor Acrescentado (IVA)", (0.1, 0.2, 0.5));

        // Cabeçalho da Tabela de IVA (Fundo cinza claro)
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.93.into(), 0.94.into(), 0.96.into()]));
        operations.push(Operation::new("re", vec![40.into(), 688.into(), 515.into(), 18.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 9.0, 45.0, 693.0, "Taxa IVA", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 110.0, 693.0, "Enquadramento Legal", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 260.0, 693.0, "Base Tributavel (AOA)", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 380.0, 693.0, "IVA Liquidado (AOA)", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 480.0, 693.0, "Total (AOA)", (0.1, 0.1, 0.1));

        let mut y = 672.0;
        let mut sum_base = Decimal::ZERO;
        let mut sum_vat = Decimal::ZERO;
        let mut sum_total = Decimal::ZERO;

        for line in &report.vat {
            let label = if line.tax_rate.is_zero() {
                "Isencao de IVA (Art. 12 CIVA)"
            } else if line.tax_rate == Decimal::from(14) {
                "Taxa Normal de IVA (14%)"
            } else if line.tax_rate == Decimal::from(7) {
                "Taxa Reduzida (7%)"
            } else if line.tax_rate == Decimal::from(5) {
                "Taxa Reduzida (5%)"
            } else {
                "Taxa Especial"
            };

            let gross = line.taxable_base + line.tax_amount;
            sum_base += line.taxable_base;
            sum_vat += line.tax_amount;
            sum_total += gross;

            let rate_str = format!("{:.2}%", line.tax_rate);
            let base_str = format!("{:.2}", line.taxable_base);
            let vat_str = format!("{:.2}", line.tax_amount);
            let gross_str = format!("{:.2}", gross);

            Self::add_text(&mut operations, "F1", 9.0, 45.0, y, &rate_str, (0.0, 0.0, 0.0));
            Self::add_text(&mut operations, "F1", 9.0, 110.0, y, label, (0.0, 0.0, 0.0));
            Self::add_text(&mut operations, "F1", 9.0, 260.0, y, &base_str, (0.0, 0.0, 0.0));
            Self::add_text(&mut operations, "F1", 9.0, 380.0, y, &vat_str, (0.0, 0.0, 0.0));
            Self::add_text(&mut operations, "F1", 9.0, 480.0, y, &gross_str, (0.0, 0.0, 0.0));

            Self::draw_horizontal_line(&mut operations, 40.0, 555.0, y - 4.0, 0.5, (0.9, 0.9, 0.9));
            y -= 18.0;
        }

        // Linha de Totais de IVA
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.93.into(), 0.95.into(), 1.0.into()]));
        operations.push(Operation::new("re", vec![40.into(), (y - 3.0).into(), 515.into(), 16.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 9.0, 45.0, y, "TOTAL GERAL IVA", (0.1, 0.2, 0.5));
        Self::add_text(&mut operations, "F2", 9.0, 260.0, y, &format!("{:.2}", sum_base), (0.1, 0.2, 0.5));
        Self::add_text(&mut operations, "F2", 9.0, 380.0, y, &format!("{:.2}", sum_vat), (0.1, 0.2, 0.5));
        Self::add_text(&mut operations, "F2", 9.0, 480.0, y, &format!("{:.2}", sum_total), (0.1, 0.2, 0.5));

        y -= 35.0;

        // 3. Seccao 2: Retenção na Fonte e Imposto de Selo
        Self::add_text(&mut operations, "F2", 11.0, 40.0, y, "2. Retencao na Fonte e Imposto de Selo", (0.1, 0.2, 0.5));
        y -= 20.0;

        // Cabeçalho da tabela de retenções
        operations.push(Operation::new("q", vec![]));
        operations.push(Operation::new("rg", vec![0.93.into(), 0.94.into(), 0.96.into()]));
        operations.push(Operation::new("re", vec![40.into(), y.into(), 515.into(), 18.into()]));
        operations.push(Operation::new("f", vec![]));
        operations.push(Operation::new("Q", vec![]));

        Self::add_text(&mut operations, "F2", 9.0, 45.0, y + 5.0, "Tributo / Enquadramento", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 250.0, y + 5.0, "Base Legal / Incidencia", (0.1, 0.1, 0.1));
        Self::add_text(&mut operations, "F2", 9.0, 440.0, y + 5.0, "Montante Retido (AOA)", (0.1, 0.1, 0.1));

        y -= 18.0;
        Self::add_text(&mut operations, "F1", 9.0, 45.0, y, "Retencao na Fonte (RF)", (0.0, 0.0, 0.0));
        Self::add_text(&mut operations, "F1", 9.0, 250.0, y, "Servicos (6.5%) / Entidades Sujeitas", (0.0, 0.0, 0.0));
        Self::add_text(&mut operations, "F2", 9.0, 440.0, y, &format!("{:.2}", report.withholding_total), (0.0, 0.0, 0.0));
        Self::draw_horizontal_line(&mut operations, 40.0, 555.0, y - 4.0, 0.5, (0.9, 0.9, 0.9));

        y -= 18.0;
        Self::add_text(&mut operations, "F1", 9.0, 45.0, y, "Imposto de Selo (IS)", (0.0, 0.0, 0.0));
        Self::add_text(&mut operations, "F1", 9.0, 250.0, y, "Recibos de Quitacao (0.7%) / TGIS", (0.0, 0.0, 0.0));
        Self::add_text(&mut operations, "F2", 9.0, 440.0, y, &format!("{:.2}", report.stamp_duty_total), (0.0, 0.0, 0.0));
        Self::draw_horizontal_line(&mut operations, 40.0, 555.0, y - 4.0, 0.5, (0.9, 0.9, 0.9));

        // 4. Rodapé Institucional
        Self::draw_horizontal_line(&mut operations, 40.0, 555.0, 50.0, 0.8, (0.7, 0.7, 0.7));
        Self::add_text(&mut operations, "F1", 8.0, 40.0, 38.0, "Documento emitido automaticamente pelo modulo fiscal Kudiba Invoicing para efeitos de declaracao tributaria.", (0.4, 0.4, 0.4));
        Self::add_text(&mut operations, "F2", 8.0, 470.0, 38.0, "Pagina 1 de 1", (0.4, 0.4, 0.4));

        let content = Content { operations };
        let encoded_bytes = content
            .encode()
            .map_err(|e| DomainError::invalid(format!("Erro ao codificar conteudo PDF: {e:?}")))?;

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
        doc.compress();

        let mut output = Vec::new();
        doc.save_to(&mut output)
            .map_err(|e| DomainError::invalid(format!("Erro ao gerar stream binario de PDF: {e}")))?;

        Ok(output)
    }

    fn add_text(
        ops: &mut Vec<Operation>,
        font: &str,
        size: f64,
        x: f64,
        y: f64,
        text: &str,
        color: (f64, f64, f64),
    ) {
        ops.push(Operation::new("q", vec![]));
        ops.push(Operation::new("rg", vec![color.0.into(), color.1.into(), color.2.into()]));
        ops.push(Operation::new("BT", vec![]));
        ops.push(Operation::new("Tf", vec![font.into(), size.into()]));
        ops.push(Operation::new("Td", vec![x.into(), y.into()]));
        ops.push(Operation::new("Tj", vec![Object::string_literal(text)]));
        ops.push(Operation::new("ET", vec![]));
        ops.push(Operation::new("Q", vec![]));
    }

    fn draw_horizontal_line(
        ops: &mut Vec<Operation>,
        x1: f64,
        x2: f64,
        y: f64,
        width: f64,
        color: (f64, f64, f64),
    ) {
        ops.push(Operation::new("q", vec![]));
        ops.push(Operation::new("w", vec![width.into()]));
        ops.push(Operation::new("RG", vec![color.0.into(), color.1.into(), color.2.into()]));
        ops.push(Operation::new("m", vec![x1.into(), y.into()]));
        ops.push(Operation::new("l", vec![x2.into(), y.into()]));
        ops.push(Operation::new("S", vec![]));
        ops.push(Operation::new("Q", vec![]));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use crate::application::queries::fiscal_reports::VatReportLine;

    #[test]
    fn gera_relatorio_pdf_valido() {
        let report = FiscalReportResult {
            tenant_id: Uuid::new_v4(),
            fiscal_year: 2026,
            fiscal_month: Some(10),
            vat: vec![
                VatReportLine {
                    tax_rate: Decimal::from(14),
                    taxable_base: Decimal::from(1500000),
                    tax_amount: Decimal::from(210000),
                },
                VatReportLine {
                    tax_rate: Decimal::ZERO,
                    taxable_base: Decimal::from(300000),
                    tax_amount: Decimal::ZERO,
                },
            ],
            withholding_total: Decimal::from(97500),
            stamp_duty_total: Decimal::from(10500),
        };

        let pdf = TaxPdfReportGenerator::generate_pdf(&report).expect("geração de PDF");
        assert!(!pdf.is_empty());
        // Ficheiros PDF começam obrigatoriamente com a assinatura "%PDF-"
        assert_eq!(&pdf[0..5], b"%PDF-");
    }
}
