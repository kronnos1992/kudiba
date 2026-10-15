use async_trait::async_trait;
use chrono::NaiveDate;
use rust_decimal_macros::dec;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use kudiba_accounting::application::commands::{
    OpenFiscalYearHandler, PostManualEntryHandler, SeedStandardPgcHandler,
};
use kudiba_accounting::application::dto::{
    CreateFiscalYearRequest, ManualLineRequest, PostManualEntryRequest,
};
use kudiba_accounting::application::queries::AccountingQueries;
use kudiba_accounting::domain::entities::{
    Account, FiscalYear, Journal, JournalEntry, JournalLine,
};
use kudiba_accounting::domain::error::DomainError;
use kudiba_accounting::domain::ports::{
    AccountRepository, FiscalYearRepository, JournalEntryRepository, JournalRepository,
};
use kudiba_accounting::domain::services::{AccountingRulesService, TrialBalanceCalculator};
use kudiba_accounting::domain::value_objects::{
    AccountClass, AccountNature, EntryStatus, FiscalYearStatus, JournalType,
};
use kudiba_accounting::infrastructure::saft::SaftAccountingGenerator;

// =============================================================================
// REPOSITÓRIOS EM MEMÓRIA (MOCKS)
// =============================================================================

#[derive(Default)]
struct MockAccountRepository {
    items: Mutex<HashMap<(Uuid, String), Account>>,
}

#[async_trait]
impl AccountRepository for MockAccountRepository {
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Account>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock.get(&(tenant_id, code.to_string())).cloned())
    }

    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<Account>, DomainError> {
        let lock = self.items.lock().unwrap();
        let mut list: Vec<Account> = lock
            .iter()
            .filter(|((t, _), _)| *t == tenant_id)
            .map(|(_, a)| a.clone())
            .collect();
        list.sort_by(|a, b| a.account_code.cmp(&b.account_code));
        Ok(list)
    }

    async fn save(&self, account: &Account) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(
            (account.tenant_id, account.account_code.clone()),
            account.clone(),
        );
        Ok(())
    }

    async fn save_batch(&self, accounts: &[Account]) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        for a in accounts {
            lock.insert((a.tenant_id, a.account_code.clone()), a.clone());
        }
        Ok(())
    }
}

#[derive(Default)]
struct MockFiscalYearRepository {
    items: Mutex<HashMap<Uuid, FiscalYear>>,
}

#[async_trait]
impl FiscalYearRepository for MockFiscalYearRepository {
    async fn find_by_year(
        &self,
        tenant_id: Uuid,
        year: i32,
    ) -> Result<Option<FiscalYear>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|y| y.tenant_id == tenant_id && y.year_code == year)
            .cloned())
    }

    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<FiscalYear>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock.get(&id).filter(|y| y.tenant_id == tenant_id).cloned())
    }

    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<FiscalYear>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .filter(|y| y.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn save(&self, fiscal_year: &FiscalYear) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(fiscal_year.id, fiscal_year.clone());
        Ok(())
    }

    async fn update(&self, fiscal_year: &FiscalYear) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(fiscal_year.id, fiscal_year.clone());
        Ok(())
    }
}

#[derive(Default)]
struct MockJournalRepository {
    items: Mutex<HashMap<Uuid, Journal>>,
    sequences: Mutex<HashMap<(Uuid, String, i32), i64>>,
}

#[async_trait]
impl JournalRepository for MockJournalRepository {
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Journal>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|j| j.tenant_id == tenant_id && j.code == code)
            .cloned())
    }

    async fn find_by_id(&self, tenant_id: Uuid, id: Uuid) -> Result<Option<Journal>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock.get(&id).filter(|j| j.tenant_id == tenant_id).cloned())
    }

    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<Journal>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .filter(|j| j.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn save(&self, journal: &Journal) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(journal.id, journal.clone());
        Ok(())
    }

    async fn next_entry_number(
        &self,
        tenant_id: Uuid,
        journal_code: &str,
        year: i32,
    ) -> Result<i64, DomainError> {
        let mut seq_lock = self.sequences.lock().unwrap();
        let key = (tenant_id, journal_code.to_string(), year);
        let current = seq_lock.entry(key).or_insert(0);
        *current += 1;
        Ok(*current)
    }
}

#[derive(Default)]
struct MockJournalEntryRepository {
    entries: Mutex<HashMap<Uuid, JournalEntry>>,
    processed_events: Mutex<HashMap<(Uuid, Uuid), String>>,
}

#[async_trait]
impl JournalEntryRepository for MockJournalEntryRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<JournalEntry>, DomainError> {
        let lock = self.entries.lock().unwrap();
        Ok(lock.get(&id).filter(|e| e.tenant_id == tenant_id).cloned())
    }

    async fn find_by_source_ref(
        &self,
        tenant_id: Uuid,
        source_ref: &str,
    ) -> Result<Option<JournalEntry>, DomainError> {
        let lock = self.entries.lock().unwrap();
        Ok(lock
            .values()
            .find(|e| {
                e.tenant_id == tenant_id && e.source_document_ref.as_deref() == Some(source_ref)
            })
            .cloned())
    }

    async fn list_entries(
        &self,
        tenant_id: Uuid,
        journal_id: Option<Uuid>,
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<JournalEntry>, DomainError> {
        let lock = self.entries.lock().unwrap();
        let mut list: Vec<JournalEntry> = lock
            .values()
            .filter(|e| {
                e.tenant_id == tenant_id
                    && journal_id.is_none_or(|jid| e.journal_id == jid)
                    && from_date.is_none_or(|d| e.transaction_date >= d)
                    && to_date.is_none_or(|d| e.transaction_date <= d)
            })
            .cloned()
            .collect();

        list.sort_by_key(|a| std::cmp::Reverse(a.entry_number));
        let paged = list
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect();
        Ok(paged)
    }

    async fn save(&self, entry: &JournalEntry) -> Result<(), DomainError> {
        let mut lock = self.entries.lock().unwrap();
        lock.insert(entry.id, entry.clone());
        Ok(())
    }

    async fn is_event_processed(
        &self,
        tenant_id: Uuid,
        event_id: Uuid,
    ) -> Result<bool, DomainError> {
        let lock = self.processed_events.lock().unwrap();
        Ok(lock.contains_key(&(tenant_id, event_id)))
    }

    async fn mark_event_processed(
        &self,
        tenant_id: Uuid,
        event_id: Uuid,
        _event_type: &str,
        source_ref: &str,
    ) -> Result<(), DomainError> {
        let mut lock = self.processed_events.lock().unwrap();
        lock.insert((tenant_id, event_id), source_ref.to_string());
        Ok(())
    }
}

// =============================================================================
// TESTES DE DOMÍNIO E REGRAS DO PGC
// =============================================================================

#[test]
fn test_account_creation_and_pgc_class_validation() {
    let tenant_id = Uuid::new_v4();

    // Classe 1: Meios Financeiros (11 Caixa)
    let acc1 = Account::new(
        tenant_id,
        "11.1".to_string(),
        Some("11".to_string()),
        "Caixa Geral".to_string(),
        None,
        true,
        false,
        None,
    )
    .unwrap();
    assert_eq!(acc1.account_class, AccountClass::Class1MeiosFinanceiros);
    assert_eq!(acc1.account_nature, AccountNature::Debit);

    // Classe 7: Proveitos (71 Vendas)
    let acc7 = Account::new(
        tenant_id,
        "71.1".to_string(),
        Some("71".to_string()),
        "Vendas de Mercadorias".to_string(),
        None,
        true,
        false,
        None,
    )
    .unwrap();
    assert_eq!(acc7.account_class, AccountClass::Class7Proveitos);
    assert_eq!(acc7.account_nature, AccountNature::Credit);

    // Conta Inválida (Classe inexistente no PGC)
    let invalid = Account::new(
        tenant_id,
        "99.1".to_string(),
        None,
        "Conta Fantasma".to_string(),
        None,
        true,
        false,
        None,
    );
    assert!(matches!(invalid, Err(DomainError::ValidationError(_))));
}

#[tokio::test]
async fn test_standard_pgc_seed() {
    let tenant_id = Uuid::new_v4();
    let account_repo = Arc::new(MockAccountRepository::default());
    let seeder = SeedStandardPgcHandler::new(account_repo.clone());

    let count = seeder.execute(tenant_id).await.unwrap();
    assert!(
        count >= 40,
        "Seed do PGC deve conter mais de 40 contas estruturadas"
    );

    let all = account_repo.list_all(tenant_id).await.unwrap();
    assert_eq!(all.len(), count);

    // Segunda chamada deve ser idempotente (retorna 0 criadas)
    let second_run = seeder.execute(tenant_id).await.unwrap();
    assert_eq!(second_run, 0);
}

#[test]
fn test_balanced_journal_entry_and_reversal() {
    let tenant_id = Uuid::new_v4();
    let fiscal_year_id = Uuid::new_v4();
    let journal_id = Uuid::new_v4();
    let entry_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();

    let line1 = JournalLine::new_debit(
        tenant_id,
        entry_id,
        1,
        "31.1.1".to_string(),
        dec!(114000),
        Some("Cliente ABC".to_string()),
        None,
        None,
    )
    .unwrap();

    let line2 = JournalLine::new_credit(
        tenant_id,
        entry_id,
        2,
        "71.1".to_string(),
        dec!(100000),
        Some("Venda Mercadorias".to_string()),
        None,
        None,
    )
    .unwrap();

    let line3 = JournalLine::new_credit(
        tenant_id,
        entry_id,
        3,
        "34.5.3.1".to_string(),
        dec!(14000),
        Some("IVA Liquidado 14%".to_string()),
        None,
        None,
    )
    .unwrap();

    // Lançamento equilibrado (114.000 D = 100.000 + 14.000 C)
    let entry = JournalEntry::new(
        tenant_id,
        fiscal_year_id,
        journal_id,
        1,
        date,
        3,
        "Venda FT 2026/001".to_string(),
        Some("kudiba-invoicing".to_string()),
        Some("FT".to_string()),
        None,
        Some("FT 2026/001".to_string()),
        vec![line1, line2, line3],
        None,
    )
    .unwrap();

    assert_eq!(entry.total_debit, dec!(114000));
    assert_eq!(entry.total_credit, dec!(114000));
    assert_eq!(entry.status, EntryStatus::Posted);

    // Teste de Estorno (Reversal)
    let reversal = entry.reverse(2, date, 3, "Anulação de Fatura").unwrap();
    assert_eq!(reversal.total_debit, dec!(114000));
    assert_eq!(reversal.total_credit, dec!(114000));
    assert_eq!(reversal.status, EntryStatus::Reversed);
    assert_eq!(reversal.reversal_of_entry_id, Some(entry.id));

    // A linha de cliente que era Débito no original passa a Crédito no estorno
    let rev_client_line = &reversal.lines[0];
    assert_eq!(rev_client_line.debit_amount, dec!(0));
    assert_eq!(rev_client_line.credit_amount, dec!(114000));
}

#[test]
fn test_unbalanced_entry_rejected() {
    let tenant_id = Uuid::new_v4();
    let entry_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();

    let line1 = JournalLine::new_debit(
        tenant_id,
        entry_id,
        1,
        "31.1.1".to_string(),
        dec!(100000),
        None,
        None,
        None,
    )
    .unwrap();

    let line2 = JournalLine::new_credit(
        tenant_id,
        entry_id,
        2,
        "71.1".to_string(),
        dec!(80000), // Desequilibrado por 20.000!
        None,
        None,
        None,
    )
    .unwrap();

    let res = JournalEntry::new(
        tenant_id,
        Uuid::new_v4(),
        Uuid::new_v4(),
        1,
        date,
        3,
        "Lançamento Cocho".to_string(),
        None,
        None,
        None,
        None,
        vec![line1, line2],
        None,
    );

    assert!(matches!(res, Err(DomainError::UnbalancedEntry(_, _))));
}

#[test]
fn test_accounting_rules_for_invoicing_events() {
    let tenant_id = Uuid::new_v4();
    let fiscal_year_id = Uuid::new_v4();
    let journal_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();

    // Venda de Serviços com IVA 14% e Retenção de 6,5%
    // Base: 100.000 AOA | IVA 14%: 14.000 AOA | Total Bruto: 114.000 AOA
    // Retenção 6,5%: 6.500 AOA | A Receber: 107.500 AOA
    let entry = AccountingRulesService::create_invoice_entry(
        tenant_id,
        fiscal_year_id,
        journal_id,
        1,
        date,
        3,
        "FT",
        "FT 2026A/100",
        "Empresa Nacional Lda",
        dec!(100000),
        dec!(14000),
        dec!(6500),
        dec!(114000),
    )
    .unwrap();

    assert_eq!(entry.lines.len(), 4);
    assert_eq!(entry.total_debit, dec!(114000));
    assert_eq!(entry.total_credit, dec!(114000));

    // Débitos: 31.1.1 (107.500) + 34.2.1 (6.500) = 114.000
    // Créditos: 71.1 (100.000) + 34.5.3.1 (14.000) = 114.000
    let client_line = entry
        .lines
        .iter()
        .find(|l| l.account_code == "31.1.1")
        .unwrap();
    assert_eq!(client_line.debit_amount, dec!(107500));

    let ret_line = entry
        .lines
        .iter()
        .find(|l| l.account_code == "34.2.1")
        .unwrap();
    assert_eq!(ret_line.debit_amount, dec!(6500));
}

#[test]
fn test_accounting_rules_for_stock_cmp_dispatch() {
    let tenant_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();

    let entry = AccountingRulesService::create_stock_dispatch_entry(
        tenant_id,
        Uuid::new_v4(),
        Uuid::new_v4(),
        1,
        date,
        3,
        "FT 2026A/100",
        dec!(65000), // Custo Médio Ponderado das unidades faturadas
    )
    .unwrap();

    assert_eq!(entry.total_debit, dec!(65000));
    assert_eq!(entry.total_credit, dec!(65000));
    assert_eq!(entry.lines[0].account_code, "61.1");
    assert_eq!(entry.lines[1].account_code, "22.1");
}

#[test]
fn test_trial_balance_calculation_4_and_6_columns() {
    let tenant_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();

    let accounts = vec![
        Account::new(
            tenant_id,
            "11.1".to_string(),
            None,
            "Caixa Geral".to_string(),
            None,
            true,
            true,
            None,
        )
        .unwrap(),
        Account::new(
            tenant_id,
            "11.2".to_string(),
            None,
            "Caixas de Balcão".to_string(),
            None,
            true,
            true,
            None,
        )
        .unwrap(),
        Account::new(
            tenant_id,
            "31.1.1".to_string(),
            None,
            "Clientes".to_string(),
            None,
            true,
            true,
            None,
        )
        .unwrap(),
        Account::new(
            tenant_id,
            "71.1".to_string(),
            None,
            "Vendas".to_string(),
            None,
            true,
            true,
            None,
        )
        .unwrap(),
        Account::new(
            tenant_id,
            "34.5.3.1".to_string(),
            None,
            "IVA Liquidado".to_string(),
            None,
            true,
            true,
            None,
        )
        .unwrap(),
    ];

    let entry = AccountingRulesService::create_invoice_entry(
        tenant_id,
        Uuid::new_v4(),
        Uuid::new_v4(),
        1,
        date,
        3,
        "FR",
        "FR 2026/01",
        "Consumidor Final",
        dec!(100000),
        dec!(14000),
        dec!(0),
        dec!(114000),
    )
    .unwrap();

    let report = TrialBalanceCalculator::calculate(&accounts, &[entry]);
    assert!(report.is_balanced);
    assert_eq!(report.total_period_debit, dec!(114000));
    assert_eq!(report.total_period_credit, dec!(114000));
    assert_eq!(report.total_closing_debit, dec!(114000));
    assert_eq!(report.total_closing_credit, dec!(114000));
}

#[test]
fn test_saft_ao_accounting_xml_generation() {
    let tenant_id = Uuid::new_v4();
    let date = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
    let end_date = NaiveDate::from_ymd_opt(2026, 12, 31).unwrap();

    let accounts = vec![
        Account::new(
            tenant_id,
            "11.1".to_string(),
            None,
            "Caixa Geral".to_string(),
            None,
            true,
            true,
            Some("11.1".to_string()),
        )
        .unwrap(),
        Account::new(
            tenant_id,
            "71.1".to_string(),
            None,
            "Vendas".to_string(),
            None,
            true,
            true,
            Some("71.1".to_string()),
        )
        .unwrap(),
    ];

    let journal = Journal::new(
        tenant_id,
        "VEND".to_string(),
        "Diário de Vendas".to_string(),
        JournalType::Sales,
    )
    .unwrap();

    let line1 = JournalLine::new_debit(
        tenant_id,
        Uuid::new_v4(),
        1,
        "11.1".to_string(),
        dec!(50000),
        None,
        None,
        None,
    )
    .unwrap();
    let line2 = JournalLine::new_credit(
        tenant_id,
        Uuid::new_v4(),
        2,
        "71.1".to_string(),
        dec!(50000),
        None,
        None,
        None,
    )
    .unwrap();
    let entry = JournalEntry::new(
        tenant_id,
        Uuid::new_v4(),
        journal.id,
        1,
        date,
        1,
        "Venda Balcão".to_string(),
        Some("invoicing".to_string()),
        Some("FR".to_string()),
        None,
        Some("FR 2026/1".to_string()),
        vec![line1, line2],
        None,
    )
    .unwrap();

    let xml = SaftAccountingGenerator::generate_xml(
        tenant_id,
        "Kudiba Comércio Lda",
        "5412345678",
        2026,
        date,
        end_date,
        &accounts,
        &[journal],
        &[entry],
    );

    assert!(xml.contains("<AuditFile"));
    assert!(xml.contains("<TaxAccountingBasis>C</TaxAccountingBasis>"));
    assert!(xml.contains("<GeneralLedgerAccounts>"));
    assert!(xml.contains("<AccountID>11.1</AccountID>"));
    assert!(xml.contains("<GeneralLedgerEntries>"));
    assert!(xml.contains("<NumberOfEntries>1</NumberOfEntries>"));
    assert!(xml.contains("<TotalDebit>50000.00</TotalDebit>"));
    assert!(xml.contains("<TotalCredit>50000.00</TotalCredit>"));
}

#[tokio::test]
async fn test_full_application_use_case_flow() {
    let tenant_id = Uuid::new_v4();

    let acc_repo = Arc::new(MockAccountRepository::default());
    let year_repo = Arc::new(MockFiscalYearRepository::default());
    let jrn_repo = Arc::new(MockJournalRepository::default());
    let entry_repo = Arc::new(MockJournalEntryRepository::default());

    let seed_pgc = SeedStandardPgcHandler::new(acc_repo.clone());
    let open_year = OpenFiscalYearHandler::new(year_repo.clone());
    let post_entry = PostManualEntryHandler::new(
        entry_repo.clone(),
        jrn_repo.clone(),
        year_repo.clone(),
        acc_repo.clone(),
    );
    let queries = AccountingQueries::new(
        acc_repo.clone(),
        entry_repo.clone(),
        jrn_repo.clone(),
        year_repo.clone(),
    );

    // 1. Inicializar PGC
    seed_pgc.execute(tenant_id).await.unwrap();

    // 2. Abrir Exercício Fiscal 2026
    let year = open_year
        .execute(tenant_id, CreateFiscalYearRequest { year_code: 2026 })
        .await
        .unwrap();
    assert_eq!(year.year_code, 2026);
    assert_eq!(year.status, FiscalYearStatus::Open);

    // 3. Criar Diário de Operações Diversas
    let jrn = Journal::new(
        tenant_id,
        "OD".to_string(),
        "Operações Diversas".to_string(),
        JournalType::Operations,
    )
    .unwrap();
    jrn_repo.save(&jrn).await.unwrap();

    // 4. Lançamento Manual (Partidas Dobradas)
    let entry = post_entry
        .execute(
            tenant_id,
            PostManualEntryRequest {
                fiscal_year: 2026,
                journal_code: "OD".to_string(),
                transaction_date: NaiveDate::from_ymd_opt(2026, 2, 10).unwrap(),
                period: 2,
                description: "Depósito de Capital Social".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "12.1".to_string(),
                        description: Some("Entrada em Banco BFA".to_string()),
                        debit_amount: Some(dec!(5000000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "51".to_string(),
                        description: Some("Realização de Capital Social".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(5000000)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                ],
            },
            None,
        )
        .await
        .unwrap();

    assert_eq!(entry.entry_number, 1);
    assert_eq!(entry.total_debit, dec!(5000000));
    assert_eq!(entry.total_credit, dec!(5000000));

    // 5. Consultar Balancete
    let balance = queries
        .get_trial_balance(tenant_id, None, None)
        .await
        .unwrap();

    assert!(balance.is_balanced);
    assert_eq!(balance.total_period_debit, dec!(5000000));
    assert_eq!(balance.total_period_credit, dec!(5000000));
}
