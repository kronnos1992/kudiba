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
            // CLASSE 1: MEIOS FINANCEIROS LÍQUIDOS
            ("11", None, "Caixa", AccountNature::Debit, false),
            (
                "11.1",
                Some("11"),
                "Caixa Geral",
                AccountNature::Debit,
                true,
            ),
            (
                "11.2",
                Some("11"),
                "Caixas de Balcão / Lojas",
                AccountNature::Debit,
                true,
            ),
            (
                "12",
                None,
                "Bancos - Depósitos à Ordem",
                AccountNature::Debit,
                false,
            ),
            (
                "12.1",
                Some("12"),
                "Bancos D.O. - Moeda Nacional",
                AccountNature::Debit,
                true,
            ),
            (
                "12.2",
                Some("12"),
                "Bancos D.O. - Moeda Estrangeira",
                AccountNature::Debit,
                true,
            ),
            (
                "13",
                None,
                "Bancos - Depósitos a Prazo",
                AccountNature::Debit,
                true,
            ),
            (
                "14",
                None,
                "Outros Meios Financeiros Líquidos",
                AccountNature::Debit,
                true,
            ),
            // CLASSE 2: EXISTÊNCIAS
            ("21", None, "Compras", AccountNature::Debit, false),
            (
                "21.1",
                Some("21"),
                "Compras de Mercadorias",
                AccountNature::Debit,
                true,
            ),
            ("22", None, "Mercadorias", AccountNature::Debit, false),
            (
                "22.1",
                Some("22"),
                "Mercadorias em Armazém",
                AccountNature::Debit,
                true,
            ),
            (
                "23",
                None,
                "Matérias-Primas e Subsidiárias",
                AccountNature::Debit,
                true,
            ),
            (
                "26",
                None,
                "Produtos Acabados e Intermédios",
                AccountNature::Debit,
                true,
            ),
            (
                "28",
                None,
                "Regularização de Existências",
                AccountNature::Debit,
                true,
            ),
            // CLASSE 3: TERCEIROS
            ("31", None, "Clientes", AccountNature::Debit, false),
            (
                "31.1",
                Some("31"),
                "Clientes - Conta Corrente",
                AccountNature::Debit,
                false,
            ),
            (
                "31.1.1",
                Some("31.1"),
                "Clientes Nacionais",
                AccountNature::Debit,
                true,
            ),
            (
                "31.1.2",
                Some("31.1"),
                "Clientes Estrangeiros",
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
            ("32", None, "Fornecedores", AccountNature::Credit, false),
            (
                "32.1",
                Some("32"),
                "Fornecedores - Conta Corrente",
                AccountNature::Credit,
                false,
            ),
            (
                "32.1.1",
                Some("32.1"),
                "Fornecedores Nacionais",
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
                "Imposto Industrial",
                AccountNature::Credit,
                true,
            ),
            (
                "34.2",
                Some("34"),
                "Retenções na Fonte de Imposto Industrial",
                AccountNature::Credit,
                false,
            ),
            (
                "34.2.1",
                Some("34.2"),
                "Retenção Suportada 6,5% (Ativo)",
                AccountNature::Debit,
                true,
            ),
            (
                "34.2.2",
                Some("34.2"),
                "Retenção Efetuada a Terceiros 6,5% (Passivo)",
                AccountNature::Credit,
                true,
            ),
            (
                "34.3",
                Some("34"),
                "Segurança Social (INSS)",
                AccountNature::Credit,
                false,
            ),
            (
                "34.3.1",
                Some("34.3"),
                "INSS Retido ao Pessoal (3%)",
                AccountNature::Credit,
                true,
            ),
            (
                "34.3.2",
                Some("34.3"),
                "INSS Encargo Patronal (8%)",
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
                "Remunerações a Pagar",
                AccountNature::Credit,
                true,
            ),
            (
                "37",
                None,
                "Outros Devedores e Outros Credores",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 4: IMOBILIZAÇÕES
            (
                "41",
                None,
                "Imobilizações Corpóreas",
                AccountNature::Debit,
                true,
            ),
            (
                "42",
                None,
                "Imobilizações Incorpóreas",
                AccountNature::Debit,
                true,
            ),
            (
                "43",
                None,
                "Amortizações Acumuladas",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 5: CAPITAL PRÓPRIO
            ("51", None, "Capital Social", AccountNature::Credit, true),
            ("55", None, "Reservas", AccountNature::Credit, true),
            (
                "56",
                None,
                "Resultados Transitados",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 6: CUSTOS POR NATUREZA
            (
                "61",
                None,
                "Custo das Mercadorias Vendidas e Matérias Consumidas (CMVMC)",
                AccountNature::Debit,
                false,
            ),
            (
                "61.1",
                Some("61"),
                "CMVMC - Mercadorias",
                AccountNature::Debit,
                true,
            ),
            (
                "62",
                None,
                "Fornecimentos e Serviços Externos (FSE)",
                AccountNature::Debit,
                false,
            ),
            (
                "62.1",
                Some("62"),
                "Água e Eletricidade",
                AccountNature::Debit,
                true,
            ),
            (
                "62.2",
                Some("62"),
                "Comunicações e Internet",
                AccountNature::Debit,
                true,
            ),
            (
                "62.3",
                Some("62"),
                "Rendas e Alugueres",
                AccountNature::Debit,
                true,
            ),
            (
                "63",
                None,
                "Custos com o Pessoal",
                AccountNature::Debit,
                false,
            ),
            (
                "63.1",
                Some("63"),
                "Remunerações do Pessoal",
                AccountNature::Debit,
                true,
            ),
            (
                "63.2",
                Some("63"),
                "Encargos Sociais s/ Remunerações",
                AccountNature::Debit,
                true,
            ),
            (
                "64",
                None,
                "Amortizações do Exercício",
                AccountNature::Debit,
                true,
            ),
            ("65", None, "Tributos", AccountNature::Debit, true),
            (
                "66",
                None,
                "Custos Financeiros",
                AccountNature::Debit,
                false,
            ),
            (
                "66.1",
                Some("66"),
                "Juros Suportados",
                AccountNature::Debit,
                true,
            ),
            (
                "66.3",
                Some("66"),
                "Diferenças de Câmbio Desfavoráveis",
                AccountNature::Debit,
                true,
            ),
            (
                "66.4",
                Some("66"),
                "Comissões e Despesas Bancárias",
                AccountNature::Debit,
                true,
            ),
            // CLASSE 7: PROVEITOS POR NATUREZA
            ("71", None, "Vendas", AccountNature::Credit, false),
            (
                "71.1",
                Some("71"),
                "Vendas de Mercadorias",
                AccountNature::Credit,
                true,
            ),
            (
                "72",
                None,
                "Prestações de Serviços",
                AccountNature::Credit,
                false,
            ),
            (
                "72.1",
                Some("72"),
                "Serviços Prestados no Mercado Nacional",
                AccountNature::Credit,
                true,
            ),
            (
                "75",
                None,
                "Proveitos Financeiros",
                AccountNature::Credit,
                false,
            ),
            (
                "75.1",
                Some("75"),
                "Juros Obtidos",
                AccountNature::Credit,
                true,
            ),
            (
                "75.3",
                Some("75"),
                "Diferenças de Câmbio Favoráveis",
                AccountNature::Credit,
                true,
            ),
            // CLASSE 8: RESULTADOS
            (
                "81",
                None,
                "Resultados Operacionais",
                AccountNature::Credit,
                true,
            ),
            (
                "82",
                None,
                "Resultados Financeiros",
                AccountNature::Credit,
                true,
            ),
            (
                "83",
                None,
                "Resultados Extraordinários",
                AccountNature::Credit,
                true,
            ),
            (
                "87",
                None,
                "Imposto sobre o Rendimento",
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
