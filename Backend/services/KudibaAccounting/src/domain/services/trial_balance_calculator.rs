use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::domain::entities::{Account, JournalEntry};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrialBalanceRow {
    pub account_code: String,
    pub account_name: String,
    pub is_analytical: bool,
    pub opening_debit: Decimal,
    pub opening_credit: Decimal,
    pub period_debit: Decimal,
    pub period_credit: Decimal,
    pub closing_debit: Decimal,
    pub closing_credit: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrialBalanceReport {
    pub rows: Vec<TrialBalanceRow>,
    pub total_opening_debit: Decimal,
    pub total_opening_credit: Decimal,
    pub total_period_debit: Decimal,
    pub total_period_credit: Decimal,
    pub total_closing_debit: Decimal,
    pub total_closing_credit: Decimal,
    pub is_balanced: bool,
}

pub struct TrialBalanceCalculator;

impl TrialBalanceCalculator {
    pub fn calculate(accounts: &[Account], entries: &[JournalEntry]) -> TrialBalanceReport {
        Self::calculate_with_opening(accounts, &[], entries)
    }

    pub fn calculate_with_opening(
        accounts: &[Account],
        opening_entries: &[JournalEntry],
        period_entries: &[JournalEntry],
    ) -> TrialBalanceReport {
        let mut account_map: BTreeMap<String, &Account> = BTreeMap::new();
        for acc in accounts {
            account_map.insert(acc.account_code.clone(), acc);
        }

        let mut opening_debits: BTreeMap<String, Decimal> = BTreeMap::new();
        let mut opening_credits: BTreeMap<String, Decimal> = BTreeMap::new();
        for entry in opening_entries {
            for line in &entry.lines {
                *opening_debits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.debit_amount;
                *opening_credits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.credit_amount;
            }
        }

        let mut period_debits: BTreeMap<String, Decimal> = BTreeMap::new();
        let mut period_credits: BTreeMap<String, Decimal> = BTreeMap::new();
        for entry in period_entries {
            for line in &entry.lines {
                *period_debits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.debit_amount;
                *period_credits
                    .entry(line.account_code.clone())
                    .or_insert(Decimal::ZERO) += line.credit_amount;
            }
        }

        let mut all_account_codes: std::collections::BTreeSet<String> =
            account_map.keys().cloned().collect();
        for code in opening_debits.keys() {
            all_account_codes.insert(code.clone());
        }
        for code in opening_credits.keys() {
            all_account_codes.insert(code.clone());
        }
        for code in period_debits.keys() {
            all_account_codes.insert(code.clone());
        }
        for code in period_credits.keys() {
            all_account_codes.insert(code.clone());
        }

        let mut rows = Vec::new();
        let mut total_o_debit = Decimal::ZERO;
        let mut total_o_credit = Decimal::ZERO;
        let mut total_p_debit = Decimal::ZERO;
        let mut total_p_credit = Decimal::ZERO;
        let mut total_c_debit = Decimal::ZERO;
        let mut total_c_credit = Decimal::ZERO;

        for code in all_account_codes {
            let o_raw_deb = opening_debits.get(&code).copied().unwrap_or(Decimal::ZERO);
            let o_raw_cred = opening_credits.get(&code).copied().unwrap_or(Decimal::ZERO);
            let p_deb = period_debits.get(&code).copied().unwrap_or(Decimal::ZERO);
            let p_cred = period_credits.get(&code).copied().unwrap_or(Decimal::ZERO);

            let (name, is_analytical) = match account_map.get(&code) {
                Some(acc) => {
                    if o_raw_deb == Decimal::ZERO
                        && o_raw_cred == Decimal::ZERO
                        && p_deb == Decimal::ZERO
                        && p_cred == Decimal::ZERO
                        && !acc.is_analytical
                    {
                        continue;
                    }
                    (acc.account_name.clone(), acc.is_analytical)
                }
                None => (resolve_standard_pgc_name(&code), true),
            };

            let (o_deb, o_cred) = if o_raw_deb >= o_raw_cred {
                (o_raw_deb - o_raw_cred, Decimal::ZERO)
            } else {
                (Decimal::ZERO, o_raw_cred - o_raw_deb)
            };

            let cum_deb = o_deb + p_deb;
            let cum_cred = o_cred + p_cred;
            let (c_deb, c_cred) = if cum_deb >= cum_cred {
                (cum_deb - cum_cred, Decimal::ZERO)
            } else {
                (Decimal::ZERO, cum_cred - cum_deb)
            };

            total_o_debit += o_deb;
            total_o_credit += o_cred;
            total_p_debit += p_deb;
            total_p_credit += p_cred;
            total_c_debit += c_deb;
            total_c_credit += c_cred;

            rows.push(TrialBalanceRow {
                account_code: code,
                account_name: name,
                is_analytical,
                opening_debit: o_deb,
                opening_credit: o_cred,
                period_debit: p_deb,
                period_credit: p_cred,
                closing_debit: c_deb,
                closing_credit: c_cred,
            });
        }

        let is_balanced = total_o_debit == total_o_credit
            && total_p_debit == total_p_credit
            && total_c_debit == total_c_credit;

        TrialBalanceReport {
            rows,
            total_opening_debit: total_o_debit,
            total_opening_credit: total_o_credit,
            total_period_debit: total_p_debit,
            total_period_credit: total_p_credit,
            total_closing_debit: total_c_debit,
            total_closing_credit: total_c_credit,
            is_balanced,
        }
    }
}

pub fn resolve_standard_pgc_name(code: &str) -> String {
    match code {
        "01" => "Garantias e Cauções Prestadas",
        "02" => "Garantias e Cauções Recebidas",
        "03" => "Títulos e Valores sob Custódia",
        "04" => "Compromissos e Responsabilidades Assumidas",
        "11" => "Imobilizações Corpóreas",
        "11.1" => "Terrenos e Recursos Naturais",
        "11.2" => "Edifícios e Outras Construções",
        "11.3" => "Equipamento Básico",
        "11.4" => "Equipamento de Carga e Transporte",
        "11.5" => "Equipamento Administrativo e Informático",
        "11.6" => "Taras e Vasilhame",
        "11.9" => "Outras Imobilizações Corpóreas",
        "12" => "Imobilizações Incorpóreas",
        "12.1" => "Trespasses",
        "12.2" => "Despesas de Investigação e Desenvolvimento",
        "12.3" => "Propriedade Industrial e Outros Direitos",
        "12.9" => "Outras Imobilizações Incorpóreas",
        "13" => "Investimentos Financeiros",
        "13.1" => "Partes de Capital - Empresas Subsidiárias",
        "13.2" => "Partes de Capital - Empresas Associadas",
        "13.3" => "Títulos de Investimento",
        "13.4" => "Depósitos a Prazo",
        "14" => "Imobilizações em Curso",
        "14.1" => "Obra em Curso",
        "14.2" => "Adiantamentos por Conta de Investimentos",
        "18" => "Amortizações Acumuladas",
        "18.1" => "Amortizações de Imobilizações Corpóreas",
        "18.2" => "Amortizações de Imobilizações Incorpóreas",
        "19" => "Provisões para Investimentos Financeiros",
        "21" => "Compras",
        "21.1" => "Mercadorias",
        "21.2" => "Matérias-Primas e Subsidiárias",
        "21.7" => "Devoluções de Compras",
        "21.8" => "Descontos e Abatimentos em Compras",
        "22" => "Matérias-Primas e Subsidiárias",
        "22.1" => "Matérias-Primas",
        "22.2" => "Matérias Subsidiárias",
        "23" => "Produtos Acabados e Intermédios",
        "23.1" => "Produtos Acabados",
        "23.2" => "Produtos Intermédios",
        "24" => "Subprodutos, Desperdícios, Resíduos e Refugos",
        "25" => "Produtos e Trabalhos em Curso",
        "26" => "Mercadorias",
        "26.1" => "Mercadorias em Armazém",
        "26.2" => "Mercadorias em Trânsito",
        "27" => "Matérias em Trânsito",
        "28" => "Adiantamentos por Conta de Compras",
        "29" => "Provisões para Depreciação de Existências",
        "31" => "Clientes",
        "31.1" => "Clientes - Conta Corrente",
        "31.2" => "Clientes - Títulos a Receber",
        "31.8" => "Clientes de Cobrança Duvidosa",
        "32" => "Fornecedores",
        "32.1" => "Fornecedores - Conta Corrente",
        "32.2" => "Fornecedores - Títulos a Pagar",
        "33" => "Empréstimos Bancários",
        "33.1" => "Empréstimos de Curto Prazo",
        "33.2" => "Empréstimos de Médio e Longo Prazos",
        "34" => "Estado e Outros Entes Públicos",
        "34.1" => "Imposto sobre os Rendimentos do Trabalho (IRT)",
        "34.2" => "Imposto Industrial",
        "34.2.1" => "Imposto Industrial - Pagamentos Provisórios",
        "34.2.2" => "Imposto Industrial - Estimativa de Imposto",
        "34.5" => "Imposto sobre o Valor Acrescentado (IVA)",
        "34.5.1" => "IVA Suportado - Operações Correntes",
        "34.5.2" => "IVA Dedutível - Existências e Imobilizado",
        "34.5.3" => "IVA Liquidado - Geral",
        "34.5.3.1" => "IVA Liquidado - Taxa Geral 14%",
        "34.5.3.2" => "IVA Liquidado - Taxa Reduzida",
        "34.5.5" => "IVA - Retenção na Fonte (Grandes Contribuintes)",
        "34.5.6" => "IVA - Regularizações",
        "34.5.7" => "IVA - Apuramento",
        "34.5.8" => "IVA a Pagar",
        "34.5.9" => "IVA a Recuperar",
        "34.6" => "Segurança Social (INSS)",
        "34.6.1" => "INSS - Contribuição dos Trabalhadores (3%)",
        "34.6.2" => "INSS - Contribuição da Entidade Empregadora (8%)",
        "34.8" => "Imposto de Selo",
        "35" => "Entidades Participantes e Participadas",
        "36" => "Pessoal",
        "36.1" => "Remunerações a Pagar",
        "36.2" => "Adiantamentos a Pessoal",
        "37" => "Outros Devedores e Credores",
        "37.1" => "Devedores Diversos",
        "37.2" => "Credores Diversos",
        "37.9" => "Garantias e Cauções Prestadas/Recebidas",
        "38" => "Provisões para Cobranças Duvidosas",
        "41" => "Títulos Negociáveis",
        "42" => "Depósitos a Prazo",
        "43" => "Depósitos à Ordem",
        "43.1" => "Banco BAI",
        "43.2" => "Banco BFA",
        "43.3" => "Banco BIC",
        "43.4" => "Banco Millennium Atlântico (BMA)",
        "43.5" => "Banco Standard Bank Angola (SBA)",
        "43.9" => "Outros Bancos Comerciais",
        "45" => "Caixa",
        "45.1" => "Caixa Principal / Sede",
        "45.2" => "Caixas de Balcão / Valores para Depositar",
        "45.3" => "Fundo Fixo de Maneio",
        "48" => "Transferências Internas / Meios Monetários em Trânsito",
        "51" => "Capital Social",
        "52" => "Acções / Quotas Próprias",
        "53" => "Prémios de Emissão",
        "54" => "Prestações Suplementares",
        "55" => "Reservas Legais",
        "56" => "Reservas de Reavaliação",
        "57" => "Outras Reservas",
        "58" => "Resultados Transitados",
        "59" => "Resultado Líquido do Exercício",
        "61" => "Vendas",
        "61.1" => "Vendas de Produtos Acabados",
        "61.2" => "Vendas de Produtos Intermédios",
        "61.3" => "Vendas de Mercadorias",
        "61.3.1" => "Vendas de Mercadorias - Mercado Nacional",
        "61.3.2" => "Vendas de Mercadorias - Mercado Externo",
        "61.7" => "Devoluções de Vendas",
        "61.8" => "Descontos e Abatimentos Concedidos",
        "62" => "Prestações de Serviços",
        "62.1" => "Serviços Prestados no País",
        "62.2" => "Serviços Prestados no Estrangeiro",
        "65" => "Outros Proveitos Operacionais",
        "66" => "Reversões de Provisões e Amortizações",
        "67" => "Proveitos Financeiros",
        "67.1" => "Juros de Depósitos a Prazo e Aplicações",
        "67.2" => "Diferenças de Câmbio Favoráveis Realizadas",
        "67.3" => "Diferenças de Câmbio Favoráveis Não Realizadas",
        "67.4" => "Descontos de Pronto Pagamento Obtidos",
        "68" => "Proveitos Extraordinários",
        "69" => "Trabalhos para a Própria Empresa",
        "71" => "Custo das Mercadorias Vendidas e Matérias Consumidas (CMVMC)",
        "71.1" => "CMVMC - Matérias-Primas",
        "71.2" => "CMVMC - Mercadorias",
        "72" => "Custos com o Pessoal",
        "72.1" => "Remunerações dos Órgãos Sociais",
        "72.2" => "Remunerações do Pessoal",
        "72.3" => "Encargos Sociais Obrigatórios (INSS 8%)",
        "72.4" => "Seguros de Acidentes de Trabalho",
        "72.9" => "Outros Custos com Pessoal",
        "75" => "Fornecimentos e Serviços de Terceiros (FST)",
        "75.1" => "Subcontratos e Trabalhos Especializados",
        "75.2" => "Electricidade, Água e Combustíveis",
        "75.3" => "Comunicações (Internet e Telefonia)",
        "75.4" => "Rendas e Alugueres",
        "75.5" => "Manutenção e Reparações",
        "75.6" => "Honorários e Serviços Jurídicos/Contabilidade",
        "75.7" => "Publicidade e Propaganda",
        "75.8" => "Deslocações e Estadas",
        "75.9" => "Outros Serviços de Terceiros",
        "76" => "Amortizações do Exercício",
        "77" => "Provisões do Exercício",
        "78" => "Custos Financeiros",
        "78.1" => "Juros Suportados de Empréstimos",
        "78.2" => "Diferenças de Câmbio Desfavoráveis Realizadas",
        "78.3" => "Diferenças de Câmbio Desfavoráveis Não Realizadas",
        "78.4" => "Descontos de Pronto Pagamento Concedidos",
        "78.5" => "Comissões e Despesas Bancárias",
        "79" => "Custos Extraordinários",
        "81" => "Resultados Operacionais",
        "82" => "Resultados Financeiros",
        "83" => "Resultados Correntes",
        "84" => "Resultados Extraordinários",
        "85" => "Resultado Antes de Impostos (RAI)",
        "86" => "Imposto sobre o Rendimento (Imposto Industrial)",
        "88" => "Resultado Líquido do Exercício",
        _ => return format!("Conta PGC {}", code),
    }
    .to_string()
}
