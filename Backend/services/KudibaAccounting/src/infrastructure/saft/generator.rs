use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::domain::entities::{Account, Journal, JournalEntry};

pub struct SaftAccountingGenerator;

impl SaftAccountingGenerator {
    pub fn generate_xml(
        tenant_id: Uuid,
        company_name: &str,
        tax_registration_number: &str,
        fiscal_year: i32,
        start_date: NaiveDate,
        end_date: NaiveDate,
        accounts: &[Account],
        journals: &[Journal],
        entries: &[JournalEntry],
    ) -> String {
        let mut total_debit = Decimal::ZERO;
        let mut total_credit = Decimal::ZERO;

        for entry in entries {
            total_debit += entry.total_debit;
            total_credit += entry.total_credit;
        }

        let mut xml = String::with_capacity(16 * 1024);
        xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.push_str("<AuditFile xmlns=\"urn:OECD:StandardAuditFile-Tax:AO_1.01_01\">\n");

        // Header
        xml.push_str("  <Header>\n");
        xml.push_str("    <AuditFileVersion>1.01_01</AuditFileVersion>\n");
        xml.push_str(&format!("    <CompanyID>{}</CompanyID>\n", tenant_id));
        xml.push_str(&format!(
            "    <TaxRegistrationNumber>{}</TaxRegistrationNumber>\n",
            tax_registration_number
        ));
        xml.push_str("    <TaxAccountingBasis>C</TaxAccountingBasis>\n");
        xml.push_str(&format!(
            "    <CompanyName>{}</CompanyName>\n",
            company_name
        ));
        xml.push_str(&format!("    <FiscalYear>{}</FiscalYear>\n", fiscal_year));
        xml.push_str(&format!("    <StartDate>{}</StartDate>\n", start_date));
        xml.push_str(&format!("    <EndDate>{}</EndDate>\n", end_date));
        xml.push_str("    <CurrencyCode>AOA</CurrencyCode>\n");
        xml.push_str("  </Header>\n");

        // MasterFiles - GeneralLedgerAccounts
        xml.push_str("  <MasterFiles>\n");
        xml.push_str("    <GeneralLedgerAccounts>\n");
        for acc in accounts {
            xml.push_str("      <Account>\n");
            xml.push_str(&format!(
                "        <AccountID>{}</AccountID>\n",
                acc.account_code
            ));
            xml.push_str(&format!(
                "        <AccountDescription>{}</AccountDescription>\n",
                acc.account_name
            ));
            xml.push_str("        <OpeningDebitBalance>0.00</OpeningDebitBalance>\n");
            xml.push_str("        <OpeningCreditBalance>0.00</OpeningCreditBalance>\n");
            xml.push_str("        <ClosingDebitBalance>0.00</ClosingDebitBalance>\n");
            xml.push_str("        <ClosingCreditBalance>0.00</ClosingCreditBalance>\n");
            xml.push_str(&format!(
                "        <GroupingCategory>{}</GroupingCategory>\n",
                if acc.is_analytical { "AR" } else { "GR" }
            ));
            if let Some(ref grp) = acc.saft_grouping_code {
                xml.push_str(&format!("        <GroupingCode>{}</GroupingCode>\n", grp));
            }
            xml.push_str("      </Account>\n");
        }
        xml.push_str("    </GeneralLedgerAccounts>\n");
        xml.push_str("  </MasterFiles>\n");

        // GeneralLedgerEntries
        xml.push_str("  <GeneralLedgerEntries>\n");
        xml.push_str(&format!(
            "    <NumberOfEntries>{}</NumberOfEntries>\n",
            entries.len()
        ));
        xml.push_str(&format!(
            "    <TotalDebit>{:.2}</TotalDebit>\n",
            total_debit
        ));
        xml.push_str(&format!(
            "    <TotalCredit>{:.2}</TotalCredit>\n",
            total_credit
        ));

        // Agrupamento por Diário
        for journal in journals {
            let j_entries: Vec<&JournalEntry> = entries
                .iter()
                .filter(|e| e.journal_id == journal.id)
                .collect();
            if j_entries.is_empty() {
                continue;
            }

            xml.push_str("    <Journal>\n");
            xml.push_str(&format!("      <JournalID>{}</JournalID>\n", journal.code));
            xml.push_str(&format!(
                "      <Description>{}</Description>\n",
                journal.name
            ));

            for entry in j_entries {
                xml.push_str("      <Transaction>\n");
                xml.push_str(&format!(
                    "        <TransactionID>{} {}</TransactionID>\n",
                    journal.code, entry.entry_number
                ));
                xml.push_str(&format!("        <Period>{}</Period>\n", entry.period));
                xml.push_str(&format!(
                    "        <TransactionDate>{}</TransactionDate>\n",
                    entry.transaction_date
                ));
                xml.push_str(&format!(
                    "        <SourceID>{}</SourceID>\n",
                    entry.source_service.as_deref().unwrap_or("manual")
                ));
                xml.push_str(&format!(
                    "        <Description>{}</Description>\n",
                    entry.description
                ));

                for line in &entry.lines {
                    xml.push_str("        <Line>\n");
                    xml.push_str(&format!(
                        "          <RecordID>{}</RecordID>\n",
                        line.line_number
                    ));
                    xml.push_str(&format!(
                        "          <AccountID>{}</AccountID>\n",
                        line.account_code
                    ));
                    if let Some(ref desc) = line.description {
                        xml.push_str(&format!("          <Description>{}</Description>\n", desc));
                    }
                    if line.debit_amount > Decimal::ZERO {
                        xml.push_str(&format!(
                            "          <DebitAmount>{:.2}</DebitAmount>\n",
                            line.debit_amount
                        ));
                    }
                    if line.credit_amount > Decimal::ZERO {
                        xml.push_str(&format!(
                            "          <CreditAmount>{:.2}</CreditAmount>\n",
                            line.credit_amount
                        ));
                    }
                    xml.push_str("        </Line>\n");
                }

                xml.push_str("      </Transaction>\n");
            }

            xml.push_str("    </Journal>\n");
        }

        xml.push_str("  </GeneralLedgerEntries>\n");
        xml.push_str("</AuditFile>\n");

        xml
    }
}
