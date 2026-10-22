use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::CreateAccountRequest;
use crate::domain::entities::Account;
use crate::domain::error::DomainError;
use crate::domain::ports::AccountRepository;
use crate::domain::value_objects::AccountNature;

pub struct CreateAccountHandler {
    account_repo: Arc<dyn AccountRepository>,
}

impl CreateAccountHandler {
    pub fn new(account_repo: Arc<dyn AccountRepository>) -> Self {
        Self { account_repo }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateAccountRequest,
    ) -> Result<Account, DomainError> {
        let existing = self
            .account_repo
            .find_by_code(tenant_id, &req.account_code)
            .await?;
        if existing.is_some() {
            return Err(DomainError::Conflict(format!(
                "Conta '{}' já existe para este tenant",
                req.account_code
            )));
        }

        let account = Account::new(
            tenant_id,
            req.account_code,
            req.parent_account_code,
            req.account_name,
            req.account_nature,
            req.is_analytical.unwrap_or(true),
            false,
            req.saft_grouping_code,
        )?;

        self.account_repo.save(&account).await?;
        Ok(account)
    }
}

pub struct SeedStandardPgcHandler {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Option<Arc<dyn crate::domain::ports::JournalRepository>>,
}

impl SeedStandardPgcHandler {
    pub fn new(account_repo: Arc<dyn AccountRepository>) -> Self {
        Self {
            account_repo,
            journal_repo: None,
        }
    }

    pub fn with_journals(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn crate::domain::ports::JournalRepository>,
    ) -> Self {
        Self {
            account_repo,
            journal_repo: Some(journal_repo),
        }
    }

    pub async fn execute(&self, tenant_id: Uuid) -> Result<usize, DomainError> {
        if let Some(j_repo) = &self.journal_repo {
            let existing_journals = j_repo.list_all(tenant_id).await?;
            if existing_journals.is_empty() {
                let default_journals = vec![
                    (
                        "VN",
                        "Diário de Vendas e Facturação",
                        crate::domain::value_objects::JournalType::Sales,
                    ),
                    (
                        "CP",
                        "Diário de Compras e Fornecedores",
                        crate::domain::value_objects::JournalType::Purchases,
                    ),
                    (
                        "CX",
                        "Diário de Caixa",
                        crate::domain::value_objects::JournalType::Cash,
                    ),
                    (
                        "BC",
                        "Diário de Bancos",
                        crate::domain::value_objects::JournalType::Bank,
                    ),
                    (
                        "OD",
                        "Diário de Operações Diversas",
                        crate::domain::value_objects::JournalType::Operations,
                    ),
                    (
                        "FE",
                        "Diário de Fecho e Apuramento",
                        crate::domain::value_objects::JournalType::Closing,
                    ),
                ];
                for (code, name, j_type) in default_journals {
                    let j = crate::domain::entities::Journal::new(
                        tenant_id,
                        code.to_string(),
                        name.to_string(),
                        j_type,
                    )?;
                    j_repo.save(&j).await?;
                }
            }
        }

        let existing = self.account_repo.list_all(tenant_id).await?;
        if !existing.is_empty() {
            return Ok(0); // Já inicializado
        }

        let standard_accounts = vec![
            // CLASSE 0: CONTAS DE ORDEM (Decreto n.º 82/01 de 16 de Novembro)
            (
                "01",
                None,
                "Garantias e Cauções Prestadas",
                AccountNature::Debit,
                true,
            ),
            (
                "02",
                None,
                "Garantias e Cauções Recebidas",
                AccountNature::Credit,
                true,
            ),
            (
                "03",
                None,
                "Títulos e Valores sob Custódia",
                AccountNature::Debit,
                true,
            ),
            (
                "04",
                None,
                "Compromissos e Responsabilidades Assumidas",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 1: MEIOS FIXOS E INVESTIMENTOS (Decreto n.º 82/01, Págs. 41-43)
            (
                "11",
                None,
                "Imobilizações Corpóreas",
                AccountNature::Debit,
                false,
            ),
            (
                "11.1",
                Some("11"),
                "Terrenos e Recursos Naturais",
                AccountNature::Debit,
                true,
            ),
            (
                "11.2",
                Some("11"),
                "Edifícios e Outras Construções",
                AccountNature::Debit,
                true,
            ),
            (
                "11.3",
                Some("11"),
                "Equipamento Básico",
                AccountNature::Debit,
                true,
            ),
            (
                "11.4",
                Some("11"),
                "Equipamento de Carga e Transporte",
                AccountNature::Debit,
                true,
            ),
            (
                "11.5",
                Some("11"),
                "Equipamento Administrativo e Informático",
                AccountNature::Debit,
                true,
            ),
            (
                "11.9",
                Some("11"),
                "Outras Imobilizações Corpóreas",
                AccountNature::Debit,
                true,
            ),
            (
                "12",
                None,
                "Imobilizações Incorpóreas",
                AccountNature::Debit,
                false,
            ),
            ("12.1", Some("12"), "Trespasses", AccountNature::Debit, true),
            (
                "12.2",
                Some("12"),
                "Despesas de Investigação e Desenvolvimento",
                AccountNature::Debit,
                true,
            ),
            (
                "12.3",
                Some("12"),
                "Propriedade Industrial, Softwares e Licenças",
                AccountNature::Debit,
                true,
            ),
            (
                "13",
                None,
                "Investimentos Financeiros",
                AccountNature::Debit,
                false,
            ),
            (
                "13.1",
                Some("13"),
                "Empresas Subsidiárias",
                AccountNature::Debit,
                true,
            ),
            (
                "13.2",
                Some("13"),
                "Empresas Associadas",
                AccountNature::Debit,
                true,
            ),
            (
                "13.3",
                Some("13"),
                "Outras Empresas",
                AccountNature::Debit,
                true,
            ),
            (
                "14",
                None,
                "Imobilizações em Curso",
                AccountNature::Debit,
                true,
            ),
            (
                "18",
                None,
                "Amortizações Acumuladas",
                AccountNature::Credit,
                false,
            ),
            (
                "18.1",
                Some("18"),
                "Amortizações Acumuladas - Imobilizações Corpóreas",
                AccountNature::Credit,
                true,
            ),
            (
                "18.2",
                Some("18"),
                "Amortizações Acumuladas - Imobilizações Incorpóreas",
                AccountNature::Credit,
                true,
            ),
            (
                "19",
                None,
                "Provisões para Investimentos Financeiros",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 2: EXISTÊNCIAS (Decreto n.º 82/01, Págs. 43-45)
            ("21", None, "Compras", AccountNature::Debit, false),
            (
                "21.1",
                Some("21"),
                "Matérias-Primas, Subsidiárias e de Consumo",
                AccountNature::Debit,
                true,
            ),
            (
                "21.2",
                Some("21"),
                "Compras de Mercadorias",
                AccountNature::Debit,
                true,
            ),
            (
                "22",
                None,
                "Matérias-Primas, Subsidiárias e de Consumo",
                AccountNature::Debit,
                true,
            ),
            (
                "23",
                None,
                "Produtos e Trabalhos em Curso",
                AccountNature::Debit,
                true,
            ),
            (
                "24",
                None,
                "Produtos Acabados e Intermédios",
                AccountNature::Debit,
                true,
            ),
            (
                "25",
                None,
                "Sub-produtos, Desperdícios, Resíduos e Refugos",
                AccountNature::Debit,
                true,
            ),
            ("26", None, "Mercadorias", AccountNature::Debit, false),
            (
                "26.1",
                Some("26"),
                "Mercadorias em Armazém",
                AccountNature::Debit,
                true,
            ),
            (
                "27",
                None,
                "Matérias-Primas, Mercadorias e Outros Materiais em Trânsito",
                AccountNature::Debit,
                true,
            ),
            (
                "28",
                None,
                "Adiantamentos por Conta de Compras",
                AccountNature::Debit,
                true,
            ),
            (
                "29",
                None,
                "Provisão para Depreciação de Existências",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 3: TERCEIROS (Decreto n.º 82/01, Págs. 45-48)
            ("31", None, "Clientes", AccountNature::Debit, false),
            (
                "31.1",
                Some("31"),
                "Clientes - Correntes",
                AccountNature::Debit,
                false,
            ),
            (
                "31.1.1",
                Some("31.1"),
                "Clientes Nacionais (Geral)",
                AccountNature::Debit,
                true,
            ),
            (
                "31.1.2.1",
                Some("31.1"),
                "Clientes Não Grupo Nacionais",
                AccountNature::Debit,
                true,
            ),
            (
                "31.1.2.2",
                Some("31.1"),
                "Clientes Não Grupo Estrangeiros",
                AccountNature::Debit,
                true,
            ),
            (
                "31.2",
                Some("31"),
                "Clientes - Títulos a Receber",
                AccountNature::Debit,
                true,
            ),
            (
                "31.8",
                Some("31"),
                "Clientes de Cobrança Duvidosa",
                AccountNature::Debit,
                true,
            ),
            ("32", None, "Fornecedores", AccountNature::Credit, false),
            (
                "32.1",
                Some("32"),
                "Fornecedores - Correntes",
                AccountNature::Credit,
                false,
            ),
            (
                "32.1.1",
                Some("32.1"),
                "Fornecedores Nacionais (Geral)",
                AccountNature::Credit,
                true,
            ),
            (
                "32.1.2.1",
                Some("32.1"),
                "Fornecedores Não Grupo Nacionais",
                AccountNature::Credit,
                true,
            ),
            (
                "32.1.2.2",
                Some("32.1"),
                "Fornecedores Não Grupo Estrangeiros",
                AccountNature::Credit,
                true,
            ),
            (
                "32.2",
                Some("32"),
                "Fornecedores - Títulos a Pagar",
                AccountNature::Credit,
                true,
            ),
            (
                "33",
                None,
                "Empréstimos Obtidos",
                AccountNature::Credit,
                false,
            ),
            (
                "33.1",
                Some("33"),
                "Empréstimos Bancários",
                AccountNature::Credit,
                true,
            ),
            (
                "34",
                None,
                "Estado e Outros Entes Públicos",
                AccountNature::Credit,
                false,
            ),
            (
                "34.1",
                Some("34"),
                "Imposto sobre os Lucros / Imposto Industrial",
                AccountNature::Credit,
                true,
            ),
            (
                "34.2",
                Some("34"),
                "Retenções na Fonte de Impostos",
                AccountNature::Credit,
                false,
            ),
            (
                "34.2.1",
                Some("34.2"),
                "Retenção na Fonte 6,5% Suportada (Ativo)",
                AccountNature::Debit,
                true,
            ),
            (
                "34.2.2",
                Some("34.2"),
                "Retenção na Fonte Efetuada a Terceiros 6,5% (Passivo)",
                AccountNature::Credit,
                true,
            ),
            (
                "34.3",
                Some("34"),
                "Imposto de Rendimento do Trabalho (IRT) e Segurança Social",
                AccountNature::Credit,
                false,
            ),
            (
                "34.3.1",
                Some("34.3"),
                "IRT Retido ao Pessoal",
                AccountNature::Credit,
                true,
            ),
            (
                "34.3.2",
                Some("34.3"),
                "Segurança Social / INSS a Entregar (11%)",
                AccountNature::Credit,
                true,
            ),
            (
                "34.5",
                Some("34"),
                "Imposto sobre o Valor Acrescentado (IVA)",
                AccountNature::Credit,
                false,
            ),
            (
                "34.5.1",
                Some("34.5"),
                "IVA Suportado",
                AccountNature::Debit,
                true,
            ),
            (
                "34.5.2",
                Some("34.5"),
                "IVA Dedutível",
                AccountNature::Debit,
                true,
            ),
            (
                "34.5.3",
                Some("34.5"),
                "IVA Liquidado",
                AccountNature::Credit,
                false,
            ),
            (
                "34.5.3.1",
                Some("34.5.3"),
                "IVA Liquidado - Taxa Geral 14%",
                AccountNature::Credit,
                true,
            ),
            (
                "34.5.3.2",
                Some("34.5.3"),
                "IVA Liquidado - Taxa Reduzida 5%",
                AccountNature::Credit,
                true,
            ),
            (
                "34.5.5",
                Some("34.5"),
                "IVA a Regularizar",
                AccountNature::Debit,
                true,
            ),
            (
                "34.5.6",
                Some("34.5"),
                "IVA - Apuramento",
                AccountNature::Credit,
                true,
            ),
            (
                "34.5.7",
                Some("34.5"),
                "IVA a Pagar",
                AccountNature::Credit,
                true,
            ),
            (
                "34.6",
                Some("34"),
                "Imposto de Selo",
                AccountNature::Credit,
                true,
            ),
            ("36", None, "Pessoal", AccountNature::Credit, false),
            (
                "36.1",
                Some("36"),
                "Pessoal - Remunerações a Pagar",
                AccountNature::Credit,
                true,
            ),
            (
                "36.1.1",
                Some("36.1"),
                "Vencimentos a Pagar ao Pessoal",
                AccountNature::Credit,
                true,
            ),
            (
                "36.2",
                Some("36"),
                "Pessoal - Participação nos Resultados",
                AccountNature::Credit,
                true,
            ),
            (
                "36.3",
                Some("36"),
                "Pessoal - Adiantamentos",
                AccountNature::Debit,
                true,
            ),
            (
                "37",
                None,
                "Outros Valores a Receber e a Pagar",
                AccountNature::Credit,
                true,
            ),
            (
                "38",
                None,
                "Provisões para Cobranças Duvidosas",
                AccountNature::Credit,
                true,
            ),
            (
                "39",
                None,
                "Provisões para Outros Riscos e Encargos",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 4: MEIOS MONETÁRIOS (Decreto n.º 82/01, Págs. 49-50)
            (
                "41",
                None,
                "Títulos Negociáveis",
                AccountNature::Debit,
                true,
            ),
            ("42", None, "Depósitos a Prazo", AccountNature::Debit, false),
            (
                "42.1",
                Some("42"),
                "Depósitos a Prazo - Moeda Nacional",
                AccountNature::Debit,
                true,
            ),
            (
                "42.2",
                Some("42"),
                "Depósitos a Prazo - Moeda Estrangeira",
                AccountNature::Debit,
                true,
            ),
            ("43", None, "Depósitos à Ordem", AccountNature::Debit, false),
            (
                "43.1",
                Some("43"),
                "Bancos D.O. - Moeda Nacional",
                AccountNature::Debit,
                true,
            ),
            (
                "43.2",
                Some("43"),
                "Bancos D.O. - Moeda Estrangeira",
                AccountNature::Debit,
                true,
            ),
            ("44", None, "Outros Depósitos", AccountNature::Debit, true),
            ("45", None, "Caixa", AccountNature::Debit, false),
            (
                "45.1",
                Some("45"),
                "Caixa Geral / Fundo Fixo",
                AccountNature::Debit,
                true,
            ),
            (
                "45.2",
                Some("45"),
                "Caixas de Balcão / Valores para Depositar",
                AccountNature::Debit,
                true,
            ),
            ("48", None, "Conta Transitória", AccountNature::Debit, true),
            (
                "49",
                None,
                "Provisões para Aplicações de Tesouraria",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 5: CAPITAL E RESERVAS (Decreto n.º 82/01, Pág. 50)
            ("51", None, "Capital", AccountNature::Credit, false),
            (
                "51.1",
                Some("51"),
                "Capital Social Subscrito e Realizado",
                AccountNature::Credit,
                true,
            ),
            (
                "52",
                None,
                "Acções/Quotas Próprias",
                AccountNature::Debit,
                true,
            ),
            (
                "54",
                None,
                "Prestações Suplementares",
                AccountNature::Credit,
                true,
            ),
            ("55", None, "Reservas Legais", AccountNature::Credit, true),
            (
                "56",
                None,
                "Reservas de Reavaliação",
                AccountNature::Credit,
                true,
            ),
            (
                "57",
                None,
                "Reservas com Fins Especiais",
                AccountNature::Credit,
                true,
            ),
            ("58", None, "Reservas Livres", AccountNature::Credit, true),
            (
                "59",
                None,
                "Resultados Transitados",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 6: PROVEITOS E GANHOS POR NATUREZA (Decreto n.º 82/01, Págs. 50-53)
            ("61", None, "Vendas", AccountNature::Credit, false),
            (
                "61.1",
                Some("61"),
                "Vendas de Produtos Acabados e Intermédios",
                AccountNature::Credit,
                true,
            ),
            (
                "61.3",
                Some("61"),
                "Vendas de Mercadorias",
                AccountNature::Credit,
                false,
            ),
            (
                "61.3.1",
                Some("61.3"),
                "Vendas de Mercadorias - Mercado Nacional",
                AccountNature::Credit,
                true,
            ),
            (
                "61.3.2",
                Some("61.3"),
                "Vendas de Mercadorias - Mercado Estrangeiro",
                AccountNature::Credit,
                true,
            ),
            (
                "62",
                None,
                "Prestações de Serviço",
                AccountNature::Credit,
                false,
            ),
            (
                "62.1",
                Some("62"),
                "Serviços Prestados no Mercado Nacional",
                AccountNature::Credit,
                true,
            ),
            (
                "62.2",
                Some("62"),
                "Serviços Prestados no Mercado Estrangeiro",
                AccountNature::Credit,
                true,
            ),
            (
                "63",
                None,
                "Outros Proveitos Operacionais",
                AccountNature::Credit,
                false,
            ),
            (
                "63.1",
                Some("63"),
                "Serviços Suplementares",
                AccountNature::Credit,
                true,
            ),
            (
                "63.3",
                Some("63"),
                "Subsídios à Exploração",
                AccountNature::Credit,
                true,
            ),
            (
                "63.8",
                Some("63"),
                "Outros Proveitos e Ganhos Operacionais",
                AccountNature::Credit,
                true,
            ),
            (
                "64",
                None,
                "Variação nos Inventários de Produção",
                AccountNature::Credit,
                true,
            ),
            (
                "65",
                None,
                "Trabalhos para a Própria Empresa",
                AccountNature::Credit,
                true,
            ),
            (
                "66",
                None,
                "Proveitos e Ganhos Financeiros Gerais",
                AccountNature::Credit,
                false,
            ),
            (
                "66.1",
                Some("66"),
                "Juros Obtidos",
                AccountNature::Credit,
                true,
            ),
            (
                "66.2",
                Some("66"),
                "Diferenças de Câmbio Favoráveis",
                AccountNature::Credit,
                true,
            ),
            (
                "66.3",
                Some("66"),
                "Descontos de Pronto Pagamento Obtidos",
                AccountNature::Credit,
                true,
            ),
            (
                "68",
                None,
                "Outros Proveitos Não Operacionais",
                AccountNature::Credit,
                true,
            ),
            (
                "69",
                None,
                "Proveitos e Ganhos Extraordinários",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 7: CUSTOS E PERDAS POR NATUREZA (Decreto n.º 82/01, Págs. 53-57)
            (
                "71",
                None,
                "Custo das Mercadorias Vendidas e Matérias Consumidas (CMVMC)",
                AccountNature::Debit,
                false,
            ),
            (
                "71.1",
                Some("71"),
                "CMVMC - Matérias-Primas e Subsidiárias",
                AccountNature::Debit,
                true,
            ),
            (
                "71.2",
                Some("71"),
                "CMVMC - Mercadorias",
                AccountNature::Debit,
                true,
            ),
            (
                "72",
                None,
                "Custos com o Pessoal",
                AccountNature::Debit,
                false,
            ),
            (
                "72.1",
                Some("72"),
                "Remunerações dos Órgãos Sociais",
                AccountNature::Debit,
                true,
            ),
            (
                "72.2",
                Some("72"),
                "Remunerações do Pessoal",
                AccountNature::Debit,
                true,
            ),
            (
                "72.5",
                Some("72"),
                "Encargos sobre Remunerações (INSS Patronal 8%)",
                AccountNature::Debit,
                true,
            ),
            (
                "72.8",
                Some("72"),
                "Outras Despesas com o Pessoal",
                AccountNature::Debit,
                true,
            ),
            (
                "73",
                None,
                "Amortizações do Exercício",
                AccountNature::Debit,
                false,
            ),
            (
                "73.1",
                Some("73"),
                "Amortizações - Imobilizações Corpóreas",
                AccountNature::Debit,
                true,
            ),
            (
                "73.2",
                Some("73"),
                "Amortizações - Imobilizações Incorpóreas",
                AccountNature::Debit,
                true,
            ),
            (
                "75",
                None,
                "Outros Custos e Perdas Operacionais (FSE e Tributos)",
                AccountNature::Debit,
                false,
            ),
            (
                "75.1",
                Some("75"),
                "Subcontratos",
                AccountNature::Debit,
                true,
            ),
            (
                "75.2",
                Some("75"),
                "Fornecimentos e Serviços de Terceiros (FSE)",
                AccountNature::Debit,
                false,
            ),
            (
                "75.2.11",
                Some("75.2"),
                "Água e Electricidade",
                AccountNature::Debit,
                true,
            ),
            (
                "75.2.20",
                Some("75.2"),
                "Comunicações e Internet",
                AccountNature::Debit,
                true,
            ),
            (
                "75.2.21",
                Some("75.2"),
                "Rendas e Alugueres",
                AccountNature::Debit,
                true,
            ),
            (
                "75.2.26",
                Some("75.2"),
                "Conservação e Reparação",
                AccountNature::Debit,
                true,
            ),
            (
                "75.3",
                Some("75"),
                "Impostos e Tributos",
                AccountNature::Debit,
                false,
            ),
            (
                "75.3.1.1",
                Some("75.3"),
                "Imposto de Selo Suportado",
                AccountNature::Debit,
                true,
            ),
            (
                "76",
                None,
                "Custos e Perdas Financeiros Gerais",
                AccountNature::Debit,
                false,
            ),
            (
                "76.1",
                Some("76"),
                "Juros Suportados",
                AccountNature::Debit,
                true,
            ),
            (
                "76.2",
                Some("76"),
                "Diferenças de Câmbio Desfavoráveis",
                AccountNature::Debit,
                true,
            ),
            (
                "76.3",
                Some("76"),
                "Descontos de Pronto Pagamento Concedidos",
                AccountNature::Debit,
                true,
            ),
            (
                "76.4",
                Some("76"),
                "Comissões e Despesas Bancárias",
                AccountNature::Debit,
                true,
            ),
            (
                "78",
                None,
                "Outros Custos e Perdas Não Operacionais",
                AccountNature::Debit,
                true,
            ),
            (
                "79",
                None,
                "Custos e Perdas Extraordinárias",
                AccountNature::Debit,
                true,
            ),
            // CLASSE 8: RESULTADOS (Decreto n.º 82/01, Pág. 58)
            (
                "82",
                None,
                "Resultados Operacionais",
                AccountNature::Credit,
                true,
            ),
            (
                "83",
                None,
                "Resultados Financeiros Gerais",
                AccountNature::Credit,
                true,
            ),
            (
                "85",
                None,
                "Resultados Não Operacionais",
                AccountNature::Credit,
                true,
            ),
            (
                "86",
                None,
                "Resultados Extraordinários",
                AccountNature::Credit,
                true,
            ),
            (
                "87",
                None,
                "Impostos sobre os Lucros",
                AccountNature::Debit,
                false,
            ),
            (
                "87.1",
                Some("87"),
                "Imposto Industrial sobre Resultados Correntes",
                AccountNature::Debit,
                true,
            ),
            (
                "88",
                None,
                "Resultado Líquido do Exercício",
                AccountNature::Credit,
                true,
            ),
        ];

        let mut accounts = Vec::with_capacity(standard_accounts.len());
        for (code, parent, name, nature, analytical) in standard_accounts {
            accounts.push(Account::new(
                tenant_id,
                code.to_string(),
                parent.map(|p| p.to_string()),
                name.to_string(),
                Some(nature),
                analytical,
                true,
                Some(code.to_string()),
            )?);
        }

        let total = accounts.len();
        self.account_repo.save_batch(&accounts).await?;
        Ok(total)
    }
}
