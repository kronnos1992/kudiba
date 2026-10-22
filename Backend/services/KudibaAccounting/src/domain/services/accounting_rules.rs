use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::domain::entities::{JournalEntry, JournalLine};
use crate::domain::error::DomainError;

pub struct AccountingRulesService;

impl AccountingRulesService {
    /// Gera lançamento de Fatura (FT/FR) ou Nota de Crédito (NC)
    pub fn create_invoice_entry(
        tenant_id: Uuid,
        fiscal_year_id: Uuid,
        journal_id: Uuid,
        entry_number: i64,
        invoice_date: NaiveDate,
        period: i32,
        doc_type: &str,
        doc_number: &str,
        customer_name: &str,
        net_total: Decimal,
        tax_total: Decimal,
        retention_total: Decimal,
        gross_total: Decimal,
    ) -> Result<JournalEntry, DomainError> {
        let entry_id = Uuid::new_v4();
        let mut lines = Vec::new();
        let mut line_seq = 1;

        match doc_type {
            "FT" => {
                // Venda a Prazo
                // 1. DÉBITO: Clientes Nacionais (Valor Líquido a Receber pós-retenção)
                let client_receivable = gross_total - retention_total;
                lines.push(JournalLine::new_debit(
                    tenant_id,
                    entry_id,
                    line_seq,
                    "31.1.2.1".to_string(),
                    client_receivable,
                    Some(format!("Cliente: {} ({})", customer_name, doc_number)),
                    None,
                    None,
                )?);
                line_seq += 1;

                // 2. DÉBITO (se houver): Retenção na Fonte de Imposto Industrial 6,5% Suportada
                if retention_total > Decimal::ZERO {
                    lines.push(JournalLine::new_debit(
                        tenant_id,
                        entry_id,
                        line_seq,
                        "34.2.1".to_string(),
                        retention_total,
                        Some(format!("Retenção Fonte 6,5% s/ {}", doc_number)),
                        None,
                        None,
                    )?);
                    line_seq += 1;
                }

                // 3. CRÉDITO: Vendas de Mercadorias / Produtos (ou Serviços) - Decreto 82/01 Conta 61
                lines.push(JournalLine::new_credit(
                    tenant_id,
                    entry_id,
                    line_seq,
                    "61.3.1".to_string(),
                    net_total,
                    Some(format!("Vendas Faturadas ({})", doc_number)),
                    None,
                    None,
                )?);
                line_seq += 1;

                // 4. CRÉDITO (se houver): IVA Liquidado a 14%
                if tax_total > Decimal::ZERO {
                    lines.push(JournalLine::new_credit(
                        tenant_id,
                        entry_id,
                        line_seq,
                        "34.5.3.1".to_string(),
                        tax_total,
                        Some(format!("IVA Liquidado 14% ({})", doc_number)),
                        None,
                        None,
                    )?);
                }
            }
            "FR" => {
                // Fatura-Recibo a Pronto Pagamento em Caixa - Decreto 82/01 Conta 45.2
                lines.push(JournalLine::new_debit(
                    tenant_id,
                    entry_id,
                    line_seq,
                    "45.2".to_string(),
                    gross_total,
                    Some(format!("Recebimento Balcão ({})", doc_number)),
                    None,
                    None,
                )?);
                line_seq += 1;

                lines.push(JournalLine::new_credit(
                    tenant_id,
                    entry_id,
                    line_seq,
                    "61.3.1".to_string(),
                    net_total,
                    Some(format!("Venda Pronto Pagamento ({})", doc_number)),
                    None,
                    None,
                )?);
                line_seq += 1;

                if tax_total > Decimal::ZERO {
                    lines.push(JournalLine::new_credit(
                        tenant_id,
                        entry_id,
                        line_seq,
                        "34.5.3.1".to_string(),
                        tax_total,
                        Some(format!("IVA Liquidado 14% ({})", doc_number)),
                        None,
                        None,
                    )?);
                }
            }
            "NC" => {
                // Nota de Crédito (Inversão / Rectificação de Venda) - Decreto 82/01 Conta 61
                lines.push(JournalLine::new_debit(
                    tenant_id,
                    entry_id,
                    line_seq,
                    "61.3.1".to_string(),
                    net_total,
                    Some(format!("Anulação / Devolução de Venda ({})", doc_number)),
                    None,
                    None,
                )?);
                line_seq += 1;

                if tax_total > Decimal::ZERO {
                    lines.push(JournalLine::new_debit(
                        tenant_id,
                        entry_id,
                        line_seq,
                        "34.5.5".to_string(),
                        tax_total,
                        Some(format!(
                            "IVA a Regularizar a Favor do Sujeito Passivo ({})",
                            doc_number
                        )),
                        None,
                        None,
                    )?);
                    line_seq += 1;
                }

                lines.push(JournalLine::new_credit(
                    tenant_id,
                    entry_id,
                    line_seq,
                    "31.1.2.1".to_string(),
                    gross_total,
                    Some(format!(
                        "Regularização Saldo Cliente: {} ({})",
                        customer_name, doc_number
                    )),
                    None,
                    None,
                )?);
            }
            _ => {
                return Err(DomainError::ValidationError(format!(
                    "Tipo de documento fiscal '{}' não mapeado para lançamento automático",
                    doc_type
                )));
            }
        }

        JournalEntry::new(
            tenant_id,
            fiscal_year_id,
            journal_id,
            entry_number,
            invoice_date,
            period,
            format!("Registo Contabilístico de {} {}", doc_type, doc_number),
            Some("kudiba-invoicing".to_string()),
            Some(doc_type.to_string()),
            None,
            Some(doc_number.to_string()),
            lines,
            None,
        )
    }

    /// Gera lançamento de Saída de Stock ao Custo Médio Ponderado (CMVMC) - Decreto 82/01
    pub fn create_stock_dispatch_entry(
        tenant_id: Uuid,
        fiscal_year_id: Uuid,
        journal_id: Uuid,
        entry_number: i64,
        movement_date: NaiveDate,
        period: i32,
        doc_ref: &str,
        cmp_total_cost: Decimal,
    ) -> Result<JournalEntry, DomainError> {
        let entry_id = Uuid::new_v4();

        // 1. DÉBITO: 71.2 Custo das Mercadorias Vendidas (CMVMC) - Decreto 82/01
        let line1 = JournalLine::new_debit(
            tenant_id,
            entry_id,
            1,
            "71.2".to_string(),
            cmp_total_cost,
            Some(format!("CMVMC ref. {}", doc_ref)),
            None,
            None,
        )?;

        // 2. CRÉDITO: 26.1 Mercadorias em Armazém - Decreto 82/01
        let line2 = JournalLine::new_credit(
            tenant_id,
            entry_id,
            2,
            "26.1".to_string(),
            cmp_total_cost,
            Some(format!("Baixa de Existências ao CMP ref. {}", doc_ref)),
            None,
            None,
        )?;

        JournalEntry::new(
            tenant_id,
            fiscal_year_id,
            journal_id,
            entry_number,
            movement_date,
            period,
            format!("Custo das Mercadorias Vendidas (CMVMC) s/ {}", doc_ref),
            Some("kudiba-inventory".to_string()),
            Some("STOCK_DISPATCH".to_string()),
            None,
            Some(doc_ref.to_string()),
            vec![line1, line2],
            None,
        )
    }

    /// Gera lançamento de Liquidação de Fatura a Prazo (Recibo de Quitação RC do KudibaTreasury) - Decreto 82/01
    pub fn create_treasury_receipt_entry(
        tenant_id: Uuid,
        fiscal_year_id: Uuid,
        journal_id: Uuid,
        entry_number: i64,
        receipt_date: NaiveDate,
        period: i32,
        receipt_number: &str,
        customer_name: &str,
        amount: Decimal,
        is_bank: bool,
    ) -> Result<JournalEntry, DomainError> {
        let entry_id = Uuid::new_v4();

        // Conta de destino: Banco 43.1 (D.O.) ou Caixa 45.1 (Caixa Geral) - Decreto 82/01
        let destination_account = if is_bank { "43.1" } else { "45.1" };

        // 1. DÉBITO: Banco ou Caixa (Entrada Financeira)
        let line1 = JournalLine::new_debit(
            tenant_id,
            entry_id,
            1,
            destination_account.to_string(),
            amount,
            Some(format!("Liquidação {} ({})", receipt_number, customer_name)),
            None,
            None,
        )?;

        // 2. CRÉDITO: 31.1.2.1 Clientes Não Grupo Nacionais (Abatimento da Dívida Corrente) - Decreto 82/01
        let line2 = JournalLine::new_credit(
            tenant_id,
            entry_id,
            2,
            "31.1.2.1".to_string(),
            amount,
            Some(format!("Quitação de Clientes conf. {}", receipt_number)),
            None,
            None,
        )?;

        JournalEntry::new(
            tenant_id,
            fiscal_year_id,
            journal_id,
            entry_number,
            receipt_date,
            period,
            format!("Cobrança de Recibo {} - {}", receipt_number, customer_name),
            Some("kudiba-treasury".to_string()),
            Some("RC".to_string()),
            None,
            Some(receipt_number.to_string()),
            vec![line1, line2],
            None,
        )
    }

    /// Gera lançamento de Processamento de Salários / Folha Salarial (KudibaPayroll) - Decreto 82/01
    pub fn create_payroll_entry(
        tenant_id: Uuid,
        fiscal_year_id: Uuid,
        journal_id: Uuid,
        entry_number: i64,
        entry_date: NaiveDate,
        period: i32,
        period_title: &str,
        total_gross: Decimal,
        total_net: Decimal,
        total_inss_employee: Decimal,
        total_inss_employer: Decimal,
        total_irt: Decimal,
    ) -> Result<JournalEntry, DomainError> {
        let entry_id = Uuid::new_v4();
        let mut lines = Vec::new();
        let mut line_seq = 1;

        // 1. DÉBITO: 72.2 - Custos com o Pessoal - Remunerações do Pessoal (Salário Ilíquido) - Decreto 82/01
        lines.push(JournalLine::new_debit(
            tenant_id,
            entry_id,
            line_seq,
            "72.2".to_string(),
            total_gross,
            Some(format!("Vencimentos Ilíquidos: {}", period_title)),
            None,
            None,
        )?);
        line_seq += 1;

        // 2. DÉBITO: 72.5 - Encargos sobre Remunerações (INSS Patronal 8%) - Decreto 82/01
        if total_inss_employer > Decimal::ZERO {
            lines.push(JournalLine::new_debit(
                tenant_id,
                entry_id,
                line_seq,
                "72.5".to_string(),
                total_inss_employer,
                Some(format!("INSS 8% Patronal: {}", period_title)),
                None,
                None,
            )?);
            line_seq += 1;
        }

        // 3. CRÉDITO: 36.1.1 - Pessoal - Vencimentos a Pagar ao Pessoal (Salário Líquido) - Decreto 82/01
        lines.push(JournalLine::new_credit(
            tenant_id,
            entry_id,
            line_seq,
            "36.1.1".to_string(),
            total_net,
            Some(format!("Salário Líquido a Pagar: {}", period_title)),
            None,
            None,
        )?);
        line_seq += 1;

        // 4. CRÉDITO: 34.3.1 - Estado e Outros Entes Públicos - IRT Retido ao Pessoal - Decreto 82/01
        if total_irt > Decimal::ZERO {
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_seq,
                "34.3.1".to_string(),
                total_irt,
                Some(format!("Retenção na Fonte de IRT: {}", period_title)),
                None,
                None,
            )?);
            line_seq += 1;
        }

        // 5. CRÉDITO: 34.3.2 - Segurança Social / INSS a Entregar (11% = 3% + 8%) - Decreto 82/01
        let inss_total = total_inss_employee + total_inss_employer;
        if inss_total > Decimal::ZERO {
            lines.push(JournalLine::new_credit(
                tenant_id,
                entry_id,
                line_seq,
                "34.3.2".to_string(),
                inss_total,
                Some(format!("Encargos e Retenções INSS 11%: {}", period_title)),
                None,
                None,
            )?);
        }

        JournalEntry::new(
            tenant_id,
            fiscal_year_id,
            journal_id,
            entry_number,
            entry_date,
            period,
            format!("Processamento de Salários - {}", period_title),
            Some("kudiba-payroll".to_string()),
            Some("FOLHA_SALARIAL".to_string()),
            None,
            Some(period_title.to_string()),
            lines,
            None,
        )
    }
}
