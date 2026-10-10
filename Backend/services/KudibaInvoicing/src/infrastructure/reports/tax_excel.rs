//! Gerador de Relatórios Fiscais em Formato Microsoft Excel (.xlsx)
//!
//! Em estrita conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas)
//! e o Código do IVA de Angola (CIVA).

use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook, XlsxError};

use crate::application::queries::fiscal_reports::FiscalReportResult;
use crate::domain::error::DomainError;

pub struct TaxExcelReportGenerator;

impl TaxExcelReportGenerator {
    /// Produz o ficheiro binário XLSX do mapa de IVA e retenções
    pub fn generate_xlsx(report: &FiscalReportResult) -> Result<Vec<u8>, DomainError> {
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.set_name("Mapa Fiscal IVA")
            .map_err(|e| DomainError::invalid(format!("Erro ao configurar planilha Excel: {e}")))?;

        // Formatações
        let title_format = Format::new()
            .set_bold()
            .set_font_size(14)
            .set_font_color(Color::RGB(0x1E3A8A)); // Indigo escuro

        let subtitle_format = Format::new()
            .set_italic()
            .set_font_size(10)
            .set_font_color(Color::RGB(0x4B5563));

        let header_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0x2563EB)) // Royal blue
            .set_font_color(Color::RGB(0xFFFFFF))
            .set_align(FormatAlign::Center)
            .set_border(FormatBorder::Thin);

        let data_format = Format::new()
            .set_border(FormatBorder::Thin);

        let number_format = Format::new()
            .set_num_format("#,##0.00")
            .set_align(FormatAlign::Right)
            .set_border(FormatBorder::Thin);

        let percent_format = Format::new()
            .set_num_format("0.00\"%\"")
            .set_align(FormatAlign::Center)
            .set_border(FormatBorder::Thin);

        let total_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0xEEF2FF))
            .set_num_format("#,##0.00")
            .set_align(FormatAlign::Right)
            .set_border(FormatBorder::Thin);

        let total_label_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0xEEF2FF))
            .set_align(FormatAlign::Left)
            .set_border(FormatBorder::Thin);

        // 1. Cabeçalho Institucional
        worksheet.write_with_format(0, 0, "KUDIBA ERP — MAPA DE APURAMENTO FISCAL E IVA", &title_format)
            .map_err(Self::map_err)?;
        worksheet.write_with_format(1, 0, "Relatório Oficial de Conformidade Contabilística (Decreto Presidencial n.º 71/25)", &subtitle_format)
            .map_err(Self::map_err)?;

        let period_label = match report.fiscal_month {
            Some(m) => format!("Período Fiscal: Mês {:02} / Exercício {}", m, report.fiscal_year),
            None => format!("Período Fiscal: Exercício Anual {}", report.fiscal_year),
        };
        worksheet.write(3, 0, &period_label).map_err(Self::map_err)?;
        worksheet.write(3, 3, format!("Tenant ID: {}", report.tenant_id)).map_err(Self::map_err)?;
        worksheet.write(4, 0, "Moeda Padrão: Kwanzas (AOA)").map_err(Self::map_err)?;

        // 2. Tabela de IVA
        let mut row: u32 = 6;
        worksheet.write_with_format(row, 0, "Taxa de IVA (%)", &header_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 1, "Enquadramento", &header_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 2, "Base Tributável (AOA)", &header_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 3, "IVA Liquidado (AOA)", &header_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 4, "Total Facturado (AOA)", &header_format).map_err(Self::map_err)?;

        row += 1;
        let mut total_base = rust_decimal::Decimal::ZERO;
        let mut total_vat = rust_decimal::Decimal::ZERO;
        let mut total_gross = rust_decimal::Decimal::ZERO;

        for line in &report.vat {
            let label = if line.tax_rate.is_zero() {
                "Isento de IVA"
            } else if line.tax_rate == rust_decimal::Decimal::from(14) {
                "Taxa Geral (14%)"
            } else if line.tax_rate == rust_decimal::Decimal::from(7) {
                "Taxa Reduzida (7%)"
            } else if line.tax_rate == rust_decimal::Decimal::from(5) {
                "Taxa Reduzida (5%)"
            } else {
                "Taxa Especial"
            };

            let gross = line.taxable_base + line.tax_amount;
            total_base += line.taxable_base;
            total_vat += line.tax_amount;
            total_gross += gross;

            worksheet.write_with_format(row, 0, line.tax_rate.to_string().parse::<f64>().unwrap_or(0.0), &percent_format).map_err(Self::map_err)?;
            worksheet.write_with_format(row, 1, label, &data_format).map_err(Self::map_err)?;
            worksheet.write_with_format(row, 2, line.taxable_base.to_string().parse::<f64>().unwrap_or(0.0), &number_format).map_err(Self::map_err)?;
            worksheet.write_with_format(row, 3, line.tax_amount.to_string().parse::<f64>().unwrap_or(0.0), &number_format).map_err(Self::map_err)?;
            worksheet.write_with_format(row, 4, gross.to_string().parse::<f64>().unwrap_or(0.0), &number_format).map_err(Self::map_err)?;
            row += 1;
        }

        // Totais de IVA
        worksheet.write_with_format(row, 0, "TOTAL GERAL IVA", &total_label_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 1, "-", &total_label_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 2, total_base.to_string().parse::<f64>().unwrap_or(0.0), &total_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 3, total_vat.to_string().parse::<f64>().unwrap_or(0.0), &total_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 4, total_gross.to_string().parse::<f64>().unwrap_or(0.0), &total_format).map_err(Self::map_err)?;

        // 3. Tabela de Retenção na Fonte e Imposto de Selo
        row += 3;
        worksheet.write_with_format(row, 0, "Imposto / Dedução Complementar", &header_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 1, "Regime Fiscal", &header_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 2, "Total Retido / Apurado (AOA)", &header_format).map_err(Self::map_err)?;

        row += 1;
        worksheet.write_with_format(row, 0, "Retenção na Fonte (RF)", &data_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 1, "Prestação de Serviços (6,5%) / Cativos", &data_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 2, report.withholding_total.to_string().parse::<f64>().unwrap_or(0.0), &number_format).map_err(Self::map_err)?;

        row += 1;
        worksheet.write_with_format(row, 0, "Imposto de Selo (IS)", &data_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 1, "Recibos de Quitação (0,7%) / TGIS", &data_format).map_err(Self::map_err)?;
        worksheet.write_with_format(row, 2, report.stamp_duty_total.to_string().parse::<f64>().unwrap_or(0.0), &number_format).map_err(Self::map_err)?;

        // Ajustar larguras das colunas
        worksheet.set_column_width(0, 22).map_err(Self::map_err)?;
        worksheet.set_column_width(1, 38).map_err(Self::map_err)?;
        worksheet.set_column_width(2, 26).map_err(Self::map_err)?;
        worksheet.set_column_width(3, 24).map_err(Self::map_err)?;
        worksheet.set_column_width(4, 26).map_err(Self::map_err)?;

        workbook.save_to_buffer().map_err(Self::map_err)
    }

    fn map_err(e: XlsxError) -> DomainError {
        DomainError::invalid(format!("Falha na geração da folha Excel XLSX: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use uuid::Uuid;
    use crate::application::queries::fiscal_reports::VatReportLine;

    #[test]
    fn gera_relatorio_excel_valido() {
        let report = FiscalReportResult {
            tenant_id: Uuid::new_v4(),
            fiscal_year: 2026,
            fiscal_month: Some(10),
            vat: vec![
                VatReportLine {
                    tax_rate: Decimal::from(14),
                    taxable_base: Decimal::from(1000000),
                    tax_amount: Decimal::from(140000),
                },
                VatReportLine {
                    tax_rate: Decimal::ZERO,
                    taxable_base: Decimal::from(200000),
                    tax_amount: Decimal::ZERO,
                },
            ],
            withholding_total: Decimal::from(65000),
            stamp_duty_total: Decimal::from(7000),
        };

        let bytes = TaxExcelReportGenerator::generate_xlsx(&report).expect("geração Excel");
        assert!(!bytes.is_empty());
        // Ficheiros XLSX são arquivos ZIP cujo cabeçalho começa com "PK\x03\x04"
        assert_eq!(&bytes[0..4], b"PK\x03\x04");
    }
}
