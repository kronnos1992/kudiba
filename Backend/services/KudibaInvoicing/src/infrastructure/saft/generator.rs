//! Gerador de ficheiros SAF-T (AO) no schema oficial da AGT
//!
//! Conformidade Legal:
//!   • Decreto Executivo n.º 385/20 — Aprovação da Estrutura SAF-T (AO) v1.01_01
//!   • Decreto Presidencial n.º 71/25 — Regime Jurídico das Facturas e Documentos Equivalentes
//!
//! Namespace XML oficial: `urn:OECD:StandardAuditFile-Tax:AO_1.01_01`

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;

use chrono::{Datelike, Utc};
use rust_decimal::Decimal;

use crate::domain::entities::invoice::{Invoice, CONSUMIDOR_FINAL};
use crate::domain::entities::tenant::Tenant;
use crate::domain::error::DomainError;

/// Metadados de contexto para exportação do SAF-T (AO)
#[derive(Debug, Clone)]
pub struct SaftExportMetadata<'a> {
    pub tenant: &'a Tenant,
    pub fiscal_year: i32,
    pub fiscal_month: Option<u32>,
    pub software_version: &'a str,
}

/// Gerador do ficheiro XML SAF-T (AO)
pub struct SaftXmlGenerator;

impl SaftXmlGenerator {
    /// Escreve o documento XML SAF-T (AO) diretamente para um fluxo de saída (`std::io::Write`),
    /// permitindo streaming com memória constante O(1) e processamento em blocos para ficheiros massivos.
    pub fn write_xml_stream<W: std::io::Write>(
        writer: &mut W,
        metadata: &SaftExportMetadata,
        invoices: &[Invoice],
    ) -> Result<(), DomainError> {
        writer
            .write_all(b"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
            .map_err(|e| DomainError::invalid(e.to_string()))?;
        writer
            .write_all(b"<AuditFile xmlns=\"urn:OECD:StandardAuditFile-Tax:AO_1.01_01\"\n           xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n")
            .map_err(|e| DomainError::invalid(e.to_string()))?;

        // 1. Secção <Header>
        let mut header_buf = String::with_capacity(4096);
        Self::append_header(&mut header_buf, metadata)?;
        writer
            .write_all(header_buf.as_bytes())
            .map_err(|e| DomainError::invalid(e.to_string()))?;

        // 2. Secção <MasterFiles>
        let mut master_buf = String::with_capacity(16 * 1024);
        Self::append_master_files(&mut master_buf, invoices)?;
        writer
            .write_all(master_buf.as_bytes())
            .map_err(|e| DomainError::invalid(e.to_string()))?;

        // 3. Secção <SourceDocuments>
        let mut src_head = String::with_capacity(1024);
        src_head.push_str("  <SourceDocuments>\n");
        src_head.push_str("    <SalesInvoices>\n");

        let number_of_entries = invoices.len();
        let mut total_debit = Decimal::ZERO;
        let mut total_credit = Decimal::ZERO;

        for inv in invoices {
            if inv.document_type == "NC" {
                total_debit += inv.gross_total;
            } else {
                total_credit += inv.gross_total;
            }
        }

        let _ = writeln!(
            src_head,
            "      <NumberOfEntries>{}</NumberOfEntries>",
            number_of_entries
        );
        let _ = writeln!(src_head, "      <TotalDebit>{:.2}</TotalDebit>", total_debit);
        let _ = writeln!(src_head, "      <TotalCredit>{:.2}</TotalCredit>", total_credit);
        writer
            .write_all(src_head.as_bytes())
            .map_err(|e| DomainError::invalid(e.to_string()))?;

        // Faturas em streaming incremental
        for inv in invoices {
            let mut inv_buf = String::with_capacity(2048);
            Self::append_invoice(&mut inv_buf, inv)?;
            writer
                .write_all(inv_buf.as_bytes())
                .map_err(|e| DomainError::invalid(e.to_string()))?;
        }

        writer
            .write_all(b"    </SalesInvoices>\n  </SourceDocuments>\n</AuditFile>\n")
            .map_err(|e| DomainError::invalid(e.to_string()))?;
        writer.flush().map_err(|e| DomainError::invalid(e.to_string()))?;

        Ok(())
    }

    /// Produz o documento XML completo no schema oficial `AO_1.01_01`
    #[allow(dead_code)]
    pub fn generate_xml(
        metadata: &SaftExportMetadata,
        invoices: &[Invoice],
    ) -> Result<String, DomainError> {
        let mut buffer = Vec::with_capacity(16 * 1024 + invoices.len() * 1024);
        Self::write_xml_stream(&mut buffer, metadata, invoices)?;
        String::from_utf8(buffer).map_err(|e| DomainError::invalid(e.to_string()))
    }

    fn append_header(xml: &mut String, meta: &SaftExportMetadata) -> Result<(), DomainError> {
        let (start_date, end_date) = compute_period_dates(meta.fiscal_year, meta.fiscal_month)?;
        let date_created = Utc::now().format("%Y-%m-%d").to_string();
        let cert_number = meta.tenant.agt_cert_number.as_deref().ok_or_else(|| {
            DomainError::invalid("Número de validação/certificação AGT não cadastrado.")
        })?;
        let address_detail = meta
            .tenant
            .address_detail
            .as_deref()
            .ok_or_else(|| DomainError::invalid("Endereço do emitente não cadastrado."))?;
        let city = meta
            .tenant
            .city
            .as_deref()
            .ok_or_else(|| DomainError::invalid("Município do emitente não cadastrado."))?;
        let country = meta
            .tenant
            .country
            .as_deref()
            .ok_or_else(|| DomainError::invalid("País do emitente não cadastrado."))?;

        xml.push_str("  <Header>\n");
        xml.push_str("    <AuditFileVersion>1.01_01</AuditFileVersion>\n");
        let _ = writeln!(
            xml,
            "    <CompanyID>{}</CompanyID>",
            xml_escape(&meta.tenant.nif)
        );
        let _ = writeln!(
            xml,
            "    <TaxRegistrationNumber>{}</TaxRegistrationNumber>",
            xml_escape(&meta.tenant.nif)
        );
        xml.push_str("    <TaxAccountingBasis>F</TaxAccountingBasis>\n");
        let _ = writeln!(
            xml,
            "    <CompanyName>{}</CompanyName>",
            xml_escape(&meta.tenant.company_name)
        );
        let _ = writeln!(
            xml,
            "    <BusinessName>{}</BusinessName>",
            xml_escape(&meta.tenant.company_name)
        );
        xml.push_str("    <CompanyAddress>\n");
        let _ = writeln!(
            xml,
            "      <AddressDetail>{}</AddressDetail>",
            xml_escape(address_detail)
        );
        let _ = writeln!(xml, "      <City>{}</City>", xml_escape(city));
        let _ = writeln!(xml, "      <Country>{}</Country>", xml_escape(country));
        xml.push_str("    </CompanyAddress>\n");
        let _ = writeln!(xml, "    <FiscalYear>{}</FiscalYear>", meta.fiscal_year);
        let _ = writeln!(xml, "    <StartDate>{}</StartDate>", start_date);
        let _ = writeln!(xml, "    <EndDate>{}</EndDate>", end_date);
        xml.push_str("    <CurrencyCode>AOA</CurrencyCode>\n");
        let _ = writeln!(xml, "    <DateCreated>{}</DateCreated>", date_created);
        xml.push_str("    <TaxEntity>Global</TaxEntity>\n");
        let _ = writeln!(
            xml,
            "    <ProductCompanyTaxID>{}</ProductCompanyTaxID>",
            xml_escape(&meta.tenant.nif)
        );
        let _ = writeln!(
            xml,
            "    <SoftwareValidationNumber>{}</SoftwareValidationNumber>",
            xml_escape(cert_number)
        );
        xml.push_str("    <ProductID>Kudiba ERP/Motor Fiscal</ProductID>\n");
        let _ = writeln!(
            xml,
            "    <ProductVersion>{}</ProductVersion>",
            xml_escape(meta.software_version)
        );
        xml.push_str("    <HeaderComment>SAF-T (AO) Mensal gerado pelo Kudiba ERP em conformidade com o Decreto Presidencial n.º 71/25</HeaderComment>\n");
        xml.push_str("  </Header>\n");

        Ok(())
    }

    fn append_master_files(xml: &mut String, invoices: &[Invoice]) -> Result<(), DomainError> {
        xml.push_str("  <MasterFiles>\n");

        // 2.1 Clientes únicos (Customer)
        let mut customers: BTreeMap<String, &str> = BTreeMap::new();
        for inv in invoices {
            customers
                .entry(inv.customer_nif.clone())
                .or_insert(&inv.customer_name);
        }

        for (nif, name) in customers {
            let tax_id = if nif.trim() == CONSUMIDOR_FINAL || nif.trim().is_empty() {
                "999999999"
            } else {
                nif.as_str()
            };
            let address = invoices.iter()
                .find(|invoice| invoice.customer_nif == nif)
                .and_then(|invoice| invoice.customer_address.as_deref())
                .ok_or_else(|| DomainError::invalid(format!(
                    "Endereço do cliente '{name}' não cadastrado; SAF-T não pode usar endereço fictício."
                )))?;
            let customer = invoices
                .iter()
                .find(|invoice| invoice.customer_nif == nif)
                .ok_or_else(|| DomainError::invalid("Cliente não encontrado no período SAF-T."))?;
            let city = customer.customer_city.as_deref().ok_or_else(|| {
                DomainError::invalid(format!("Município do cliente '{name}' não cadastrado."))
            })?;
            let country = customer.customer_country.as_deref().ok_or_else(|| {
                DomainError::invalid(format!("País do cliente '{name}' não cadastrado."))
            })?;

            xml.push_str("    <Customer>\n");
            let _ = writeln!(xml, "      <CustomerID>{}</CustomerID>", xml_escape(&nif));
            xml.push_str("      <AccountID>Desconhecido</AccountID>\n");
            let _ = writeln!(
                xml,
                "      <CustomerTaxID>{}</CustomerTaxID>",
                xml_escape(tax_id)
            );
            let _ = writeln!(xml, "      <CompanyName>{}</CompanyName>", xml_escape(name));
            xml.push_str("      <BillingAddress>\n");
            let _ = writeln!(
                xml,
                "        <AddressDetail>{}</AddressDetail>",
                xml_escape(address)
            );
            let _ = writeln!(xml, "        <City>{}</City>", xml_escape(city));
            let _ = writeln!(xml, "        <Country>{}</Country>", xml_escape(country));
            xml.push_str("      </BillingAddress>\n");
            xml.push_str("      <SelfBillingIndicator>0</SelfBillingIndicator>\n");
            xml.push_str("    </Customer>\n");
        }

        // 2.2 Produtos únicos (Product)
        let mut products: BTreeMap<String, &str> = BTreeMap::new();
        for inv in invoices {
            for line in &inv.lines {
                products
                    .entry(line.product_code.clone())
                    .or_insert(&line.description);
            }
        }

        for (code, desc) in products {
            xml.push_str("    <Product>\n");
            xml.push_str("      <ProductType>P</ProductType>\n");
            let _ = writeln!(
                xml,
                "      <ProductCode>{}</ProductCode>",
                xml_escape(&code)
            );
            xml.push_str("      <ProductGroup>Geral</ProductGroup>\n");
            let _ = writeln!(
                xml,
                "      <ProductDescription>{}</ProductDescription>",
                xml_escape(desc)
            );
            let _ = writeln!(
                xml,
                "      <ProductNumberCode>{}</ProductNumberCode>",
                xml_escape(&code)
            );
            xml.push_str("    </Product>\n");
        }

        // 2.3 Tabela de Impostos (TaxTable)
        let mut tax_rates: BTreeSet<Decimal> = BTreeSet::new();
        for inv in invoices {
            for line in &inv.lines {
                tax_rates.insert(line.tax_rate);
            }
        }
        // Garante as taxas fiscais padrão de Angola
        tax_rates.insert(Decimal::ZERO);
        tax_rates.insert(Decimal::from(7));
        tax_rates.insert(Decimal::from(14));

        xml.push_str("    <TaxTable>\n");
        for rate in tax_rates {
            let (tax_code, desc) = if rate.is_zero() {
                ("ISE", "Isento de IVA")
            } else if rate == Decimal::from(14) {
                ("NOR", "Taxa Normal de IVA (14%)")
            } else {
                ("INT", "Taxa Intermédia / Reduzida de IVA")
            };

            xml.push_str("      <TaxTableEntry>\n");
            xml.push_str("        <TaxType>IVA</TaxType>\n");
            xml.push_str("        <TaxCountryRegion>AO</TaxCountryRegion>\n");
            let _ = writeln!(xml, "        <TaxCode>{}</TaxCode>", tax_code);
            let _ = writeln!(xml, "        <Description>{}</Description>", desc);
            let _ = writeln!(xml, "        <TaxPercentage>{:.2}</TaxPercentage>", rate);
            xml.push_str("      </TaxTableEntry>\n");
        }
        xml.push_str("    </TaxTable>\n");

        xml.push_str("  </MasterFiles>\n");
        Ok(())
    }


    fn append_invoice(xml: &mut String, inv: &Invoice) -> Result<(), DomainError> {
        xml.push_str("      <Invoice>\n");
        let _ = writeln!(
            xml,
            "        <InvoiceNo>{}</InvoiceNo>",
            xml_escape(&inv.document_number)
        );
        xml.push_str("        <DocumentStatus>\n");
        xml.push_str("          <InvoiceStatus>N</InvoiceStatus>\n");
        let _ = writeln!(
            xml,
            "          <InvoiceStatusDate>{}</InvoiceStatusDate>",
            inv.system_entry_date.format("%Y-%m-%dT%H:%M:%S")
        );
        xml.push_str("          <SourceID>kudiba_user</SourceID>\n");
        xml.push_str("          <SourceBilling>P</SourceBilling>\n");
        xml.push_str("        </DocumentStatus>\n");
        let _ = writeln!(xml, "        <Hash>{}</Hash>", xml_escape(&inv.hash_sha256));
        let _ = writeln!(
            xml,
            "        <HashControl>{}</HashControl>",
            xml_escape(&inv.key_version)
        );
        let _ = writeln!(xml, "        <Period>{}</Period>", inv.issued_at.month());
        let _ = writeln!(
            xml,
            "        <InvoiceDate>{}</InvoiceDate>",
            inv.issued_at.format("%Y-%m-%d")
        );
        let _ = writeln!(
            xml,
            "        <InvoiceType>{}</InvoiceType>",
            xml_escape(&inv.document_type)
        );
        xml.push_str("        <SpecialRegimes>\n");
        xml.push_str("          <SelfBillingIndicator>0</SelfBillingIndicator>\n");
        xml.push_str("          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>\n");
        xml.push_str("          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>\n");
        xml.push_str("        </SpecialRegimes>\n");
        xml.push_str("        <SourceID>kudiba_user</SourceID>\n");
        let _ = writeln!(
            xml,
            "        <SystemEntryDate>{}</SystemEntryDate>",
            inv.system_entry_date.format("%Y-%m-%dT%H:%M:%S")
        );
        let _ = writeln!(
            xml,
            "        <CustomerID>{}</CustomerID>",
            xml_escape(&inv.customer_nif)
        );

        for line in &inv.lines {
            xml.push_str("        <Line>\n");
            let _ = writeln!(
                xml,
                "          <LineNumber>{}</LineNumber>",
                line.line_number
            );
            let _ = writeln!(
                xml,
                "          <ProductCode>{}</ProductCode>",
                xml_escape(&line.product_code)
            );
            let _ = writeln!(
                xml,
                "          <ProductDescription>{}</ProductDescription>",
                xml_escape(&line.description)
            );
            let _ = writeln!(xml, "          <Quantity>{:.4}</Quantity>", line.quantity);
            xml.push_str("          <UnitOfMeasure>Un</UnitOfMeasure>\n");
            let _ = writeln!(
                xml,
                "          <UnitPrice>{:.4}</UnitPrice>",
                line.unit_price
            );
            let _ = writeln!(
                xml,
                "          <TaxPointDate>{}</TaxPointDate>",
                inv.issued_at.format("%Y-%m-%d")
            );
            let _ = writeln!(
                xml,
                "          <Description>{}</Description>",
                xml_escape(&line.description)
            );

            if inv.document_type == "NC" {
                let _ = writeln!(
                    xml,
                    "          <DebitAmount>{:.2}</DebitAmount>",
                    line.line_total
                );
            } else {
                let _ = writeln!(
                    xml,
                    "          <CreditAmount>{:.2}</CreditAmount>",
                    line.line_total
                );
            }

            xml.push_str("          <Tax>\n");
            xml.push_str("            <TaxType>IVA</TaxType>\n");
            xml.push_str("            <TaxCountryRegion>AO</TaxCountryRegion>\n");
            let tax_code = if line.tax_rate.is_zero() {
                "ISE"
            } else if line.tax_rate == Decimal::from(14) {
                "NOR"
            } else {
                "INT"
            };
            let _ = writeln!(xml, "            <TaxCode>{}</TaxCode>", tax_code);
            let _ = writeln!(
                xml,
                "            <TaxPercentage>{:.2}</TaxPercentage>",
                line.tax_rate
            );
            xml.push_str("          </Tax>\n");

            if line.tax_rate.is_zero() {
                let exemption_code = line.tax_exemption_code.as_deref().unwrap_or("M02");
                let reason = match exemption_code {
                    "M00" => "Isenção nos termos da alínea a) do n.º 1 do art.º 12.º do CIVA",
                    "M02" => "Transmissão de bens e prestação de serviços isentas de IVA",
                    "M04" => "Isenção de bens da Cesta Básica (Lei n.º 42/20)",
                    _ => "Isenção ao abrigo do Código do Imposto sobre o Valor Acrescentado",
                };
                let _ = writeln!(
                    xml,
                    "          <TaxExemptionReason>{}</TaxExemptionReason>",
                    xml_escape(reason)
                );
                let _ = writeln!(
                    xml,
                    "          <TaxExemptionCode>{}</TaxExemptionCode>",
                    xml_escape(exemption_code)
                );
            }

            let _ = writeln!(
                xml,
                "          <SettlementAmount>{:.2}</SettlementAmount>",
                line.discount_amount
            );
            xml.push_str("        </Line>\n");
        }

        xml.push_str("        <DocumentTotals>\n");
        let _ = writeln!(
            xml,
            "          <TaxPayable>{:.2}</TaxPayable>",
            inv.tax_total
        );
        let _ = writeln!(xml, "          <NetTotal>{:.2}</NetTotal>", inv.net_total);
        let _ = writeln!(
            xml,
            "          <GrossTotal>{:.2}</GrossTotal>",
            inv.gross_total
        );
        if inv.currency != "AOA" {
            xml.push_str("          <Currency>\n");
            let _ = writeln!(
                xml,
                "            <CurrencyCode>{}</CurrencyCode>",
                xml_escape(&inv.currency)
            );
            let _ = writeln!(
                xml,
                "            <CurrencyAmount>{:.2}</CurrencyAmount>",
                inv.gross_total
            );
            xml.push_str("          </Currency>\n");
        }
        xml.push_str("        </DocumentTotals>\n");
        xml.push_str("      </Invoice>\n");

        Ok(())
    }
}

/// Calcula o intervalo de datas (início e fim) do período fiscal
fn compute_period_dates(year: i32, month: Option<u32>) -> Result<(String, String), DomainError> {
    match month {
        Some(m) if (1..=12).contains(&m) => {
            let start = format!("{:04}-{:02}-01", year, m);
            let last_day = days_in_month(year, m);
            let end = format!("{:04}-{:02}-{:02}", year, m, last_day);
            Ok((start, end))
        }
        Some(m) => Err(DomainError::invalid(format!(
            "Mês fiscal inválido: {}. Deve estar entre 1 e 12.",
            m
        ))),
        None => {
            let start = format!("{:04}-01-01", year);
            let end = format!("{:04}-12-31", year);
            Ok((start, end))
        }
    }
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(year) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// Escapa caracteres especiais para XML
fn xml_escape(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            _ => escaped.push(c),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::invoice_line::InvoiceLine;
    use uuid::Uuid;

    #[test]
    fn gera_saft_ao_valido_com_facturas_e_linhas() {
        let tenant = Tenant {
            id: Uuid::new_v4(),
            slug: "demo".to_string(),
            company_name: "Kudiba Comercial Lda".to_string(),
            nif: "5001234567".to_string(),
            address_detail: Some("Rua de teste, 1".to_string()),
            city: Some("Luanda".to_string()),
            country: Some("AO".to_string()),
            commercial_registry: Some("REG-1234".to_string()),
            tax_office_code: Some("REP-01".to_string()),
            agt_cert_number: Some("42/AGT/2026".to_string()),
            status: "ACTIVE".to_string(),
            tax_regime_code: "REGIME_GERAL".to_string(),
            contingency_started_at: None,
        };

        let metadata = SaftExportMetadata {
            tenant: &tenant,
            fiscal_year: 2026,
            fiscal_month: Some(10),
            software_version: "1.0.0",
        };

        let lines = vec![
            InvoiceLine::new(
                Uuid::new_v4(),
                Uuid::new_v4(),
                1,
                "PROD-001".to_string(),
                "Software Kudiba ERP & Suporte".to_string(),
                Decimal::from(1),
                Decimal::from(500000),
                Decimal::ZERO,
                Decimal::from(14),
                None,
                Decimal::from(570000),
            ),
            InvoiceLine::new(
                Uuid::new_v4(),
                Uuid::new_v4(),
                2,
                "PROD-002".to_string(),
                "Leite em pó (Cesta Básica)".to_string(),
                Decimal::from(2),
                Decimal::from(25000),
                Decimal::ZERO,
                Decimal::ZERO,
                Some("M04".to_string()),
                Decimal::from(50000),
            ),
        ];

        let invoice = Invoice::new(
            Uuid::new_v4(),
            tenant.id,
            tenant.nif.clone(),
            tenant.address_detail.clone().unwrap(),
            tenant.city.clone().unwrap(),
            tenant.country.clone().unwrap(),
            Uuid::new_v4(),
            "FT KUD26/000001".to_string(),
            1,
            "FT".to_string(),
            "Cliente Exemplo S.A.".to_string(),
            Some("5412345678".to_string()),
            Some("Rua do Cliente, 10".to_string()),
            Some("Luanda".to_string()),
            Some("AO".to_string()),
            None,
            vec!["TRANSFERENCIA".to_string()],
            "AOA".to_string(),
            Decimal::from(550000),
            Decimal::from(70000),
            Decimal::from(620000),
            Decimal::ZERO,
            Decimal::ZERO,
            "hash1234567890abcdef".to_string(),
            "sigBase64Example".to_string(),
            "4Chr".to_string(),
            "1".to_string(),
            false,
            "REGIME_GERAL".to_string(),
            Utc::now(),
            Utc::now(),
            lines,
        );

        let xml = SaftXmlGenerator::generate_xml(&metadata, &[invoice]).expect("geração SAF-T");

        assert!(xml.contains("xmlns=\"urn:OECD:StandardAuditFile-Tax:AO_1.01_01\""));
        assert!(xml.contains("<CompanyID>5001234567</CompanyID>"));
        assert!(
            xml.contains("<SoftwareValidationNumber>42/AGT/2026</SoftwareValidationNumber>")
        );
        assert!(xml.contains("<InvoiceNo>FT KUD26/000001</InvoiceNo>"));
        assert!(xml.contains("<TaxExemptionCode>M04</TaxExemptionCode>"));
        assert!(xml.contains("<TaxExemptionReason>Isenção de bens da Cesta Básica (Lei n.º 42/20)</TaxExemptionReason>"));
        assert!(xml.contains("<TotalCredit>620000.00</TotalCredit>"));
        assert!(xml.contains("</AuditFile>"));

        // Validação estrita contra o Schema Oficial XSD da AGT
        crate::infrastructure::saft::validator::SaftValidator::validate_xml(&xml)
            .expect("XML gerado pelo KudibaInvoicing deve ser estritamente válido segundo o schema da AGT");
    }
}
