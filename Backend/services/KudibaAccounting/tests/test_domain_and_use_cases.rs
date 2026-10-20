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
        self.save_with_event(entry, None, None, None).await
    }

    async fn update(&self, entry: &JournalEntry) -> Result<(), DomainError> {
        let mut lock = self.entries.lock().unwrap();
        let existing_status = lock
            .get(&entry.id)
            .filter(|e| e.tenant_id == entry.tenant_id)
            .map(|e| e.status);
        match existing_status {
            Some(EntryStatus::Reversed) => Err(DomainError::Conflict(
                "Lançamento estornado não pode ser editado".to_string(),
            )),
            Some(_) => {
                lock.insert(entry.id, entry.clone());
                Ok(())
            }
            None => Err(DomainError::NotFound(
                "Lançamento não encontrado".to_string(),
            )),
        }
    }

    async fn save_with_event(
        &self,
        entry: &JournalEntry,
        event_id: Option<Uuid>,
        _event_type: Option<&str>,
        source_ref: Option<&str>,
    ) -> Result<(), DomainError> {
        let mut lock = self.entries.lock().unwrap();

        if let Some(orig_id) = entry.reversal_of_entry_id {
            if let Some(orig) = lock.get_mut(&orig_id) {
                if orig.status == EntryStatus::Reversed {
                    return Err(DomainError::Conflict(
                        "O lançamento de origem já foi estornado".to_string(),
                    ));
                }
                orig.status = EntryStatus::Reversed;
            } else {
                return Err(DomainError::NotFound(
                    "Lançamento de origem não encontrado".to_string(),
                ));
            }
        }

        lock.insert(entry.id, entry.clone());
        drop(lock);

        if let (Some(ev_id), Some(s_ref)) = (event_id, source_ref) {
            let mut ev_lock = self.processed_events.lock().unwrap();
            ev_lock.insert((entry.tenant_id, ev_id), s_ref.to_string());
        }

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

#[test]
fn test_amqp_outbox_event_parsing_and_compatibility() {
    use kudiba_accounting::infrastructure::events::{AccountingEvent, AccountingEventConsumer};

    let raw_invoicing_outbox_json = r#"{
        "event_id": "a0000000-0000-0000-0000-000000000001",
        "tenant_id": "b0000000-0000-0000-0000-000000000002",
        "invoice_id": "c0000000-0000-0000-0000-000000000003",
        "event_type": "fiscal.document.issued",
        "payload": {
            "documentNumber": "FT 2026/001",
            "documentType": "FT",
            "customerName": "Kudiba Import & Export Lda",
            "netTotal": "100000.00",
            "taxTotal": "14000.00",
            "withholdingTotal": "6500.00",
            "grossTotal": "114000.00",
            "issuedAt": "2026-04-10T14:30:00Z"
        },
        "created_at": "2026-04-10T14:30:01Z"
    }"#;

    let parsed =
        AccountingEventConsumer::parse_incoming_event(raw_invoicing_outbox_json.as_bytes());
    assert!(parsed.is_some());

    if let Some(AccountingEvent::InvoiceIssued {
        doc_type,
        doc_number,
        customer_name,
        net_total,
        tax_total,
        retention_total,
        gross_total,
        issue_date,
        ..
    }) = parsed
    {
        assert_eq!(doc_type, "FT");
        assert_eq!(doc_number, "FT 2026/001");
        assert_eq!(customer_name, "Kudiba Import & Export Lda");
        assert_eq!(net_total, dec!(100000.00));
        assert_eq!(tax_total, dec!(14000.00));
        assert_eq!(retention_total, dec!(6500.00));
        assert_eq!(gross_total, dec!(114000.00));
        assert_eq!(issue_date, NaiveDate::from_ymd_opt(2026, 4, 10).unwrap());
    } else {
        panic!("Esperado AccountingEvent::InvoiceIssued a partir do OutboxEvent");
    }
}

#[tokio::test]
async fn test_reversal_status_update_and_conflict_prevention() {
    use kudiba_accounting::application::commands::ReverseEntryHandler;
    use kudiba_accounting::application::dto::ReverseEntryRequest;

    let tenant_id = Uuid::new_v4();
    let account_repo = Arc::new(MockAccountRepository::default());
    let year_repo = Arc::new(MockFiscalYearRepository::default());
    let jrn_repo = Arc::new(MockJournalRepository::default());
    let entry_repo = Arc::new(MockJournalEntryRepository::default());

    let seed_pgc = SeedStandardPgcHandler::new(account_repo.clone());
    let open_year = OpenFiscalYearHandler::new(year_repo.clone());
    let post_entry = PostManualEntryHandler::new(
        entry_repo.clone(),
        jrn_repo.clone(),
        year_repo.clone(),
        account_repo.clone(),
    );
    let reverse_handler =
        ReverseEntryHandler::new(entry_repo.clone(), jrn_repo.clone(), year_repo.clone());

    seed_pgc.execute(tenant_id).await.unwrap();
    open_year
        .execute(tenant_id, CreateFiscalYearRequest { year_code: 2026 })
        .await
        .unwrap();

    let jrn = Journal::new(
        tenant_id,
        "OD".to_string(),
        "Operações Diversas".to_string(),
        JournalType::Operations,
    )
    .unwrap();
    jrn_repo.save(&jrn).await.unwrap();

    let entry = post_entry
        .execute(
            tenant_id,
            PostManualEntryRequest {
                fiscal_year: 2026,
                journal_code: "OD".to_string(),
                transaction_date: NaiveDate::from_ymd_opt(2026, 5, 20).unwrap(),
                period: 5,
                description: "Lançamento para teste de estorno".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "11.1".to_string(),
                        description: Some("Caixa Geral".to_string()),
                        debit_amount: Some(dec!(25000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: Some("Venda".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(25000)),
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

    assert_eq!(entry.status, EntryStatus::Posted);

    // 1. Estornar pela primeira vez
    let reversed_entry = reverse_handler
        .execute(
            tenant_id,
            ReverseEntryRequest {
                entry_id: entry.id,
                reversal_date: NaiveDate::from_ymd_opt(2026, 5, 21).unwrap(),
                period: 5,
                reason: "Erro de digitação de valor".to_string(),
            },
        )
        .await
        .unwrap();

    assert_eq!(reversed_entry.status, EntryStatus::Reversed);
    assert_eq!(reversed_entry.reversal_of_entry_id, Some(entry.id));

    // 2. Verificar que o lançamento original foi atualizado para REVERSED
    let orig_reloaded = entry_repo
        .find_by_id(tenant_id, entry.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(orig_reloaded.status, EntryStatus::Reversed);

    // 3. Tentar estornar novamente deve ser rejeitado com conflito
    let second_reversal = reverse_handler
        .execute(
            tenant_id,
            ReverseEntryRequest {
                entry_id: entry.id,
                reversal_date: NaiveDate::from_ymd_opt(2026, 5, 22).unwrap(),
                period: 5,
                reason: "Tentativa de estorno duplo".to_string(),
            },
        )
        .await;

    assert!(second_reversal.is_err());
}

#[test]
fn test_trial_balance_with_opening_balances_6_columns() {
    let tenant_id = Uuid::new_v4();
    let fiscal_year_id = Uuid::new_v4();
    let journal_id = Uuid::new_v4();

    let acc_caixa = Account::new(
        tenant_id,
        "11.1".to_string(),
        Some("11".to_string()),
        "Caixa Geral".to_string(),
        Some(AccountNature::Debit),
        true,
        false,
        None,
    )
    .unwrap();

    let acc_capital = Account::new(
        tenant_id,
        "51".to_string(),
        None,
        "Capital Social".to_string(),
        Some(AccountNature::Credit),
        true,
        false,
        None,
    )
    .unwrap();

    let acc_vendas = Account::new(
        tenant_id,
        "71.1".to_string(),
        Some("71".to_string()),
        "Vendas de Mercadorias".to_string(),
        Some(AccountNature::Credit),
        true,
        false,
        None,
    )
    .unwrap();

    let accounts = vec![acc_caixa, acc_capital, acc_vendas];

    // Lançamento de Abertura (Janeiro): Entrada de Capital 100.000 em Caixa
    let opening_entry = JournalEntry::new(
        tenant_id,
        fiscal_year_id,
        journal_id,
        1,
        NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
        1,
        "Abertura de Exercício".to_string(),
        None,
        None,
        None,
        None,
        vec![
            JournalLine::new_debit(
                tenant_id,
                Uuid::new_v4(),
                1,
                "11.1".to_string(),
                dec!(100000),
                None,
                None,
                None,
            )
            .unwrap(),
            JournalLine::new_credit(
                tenant_id,
                Uuid::new_v4(),
                2,
                "51".to_string(),
                dec!(100000),
                None,
                None,
                None,
            )
            .unwrap(),
        ],
        None,
    )
    .unwrap();

    // Movimento do Período (Fevereiro): Venda em dinheiro de 50.000
    let period_entry = JournalEntry::new(
        tenant_id,
        fiscal_year_id,
        journal_id,
        2,
        NaiveDate::from_ymd_opt(2026, 2, 15).unwrap(),
        2,
        "Venda a Pronto Pagamento".to_string(),
        None,
        None,
        None,
        None,
        vec![
            JournalLine::new_debit(
                tenant_id,
                Uuid::new_v4(),
                1,
                "11.1".to_string(),
                dec!(50000),
                None,
                None,
                None,
            )
            .unwrap(),
            JournalLine::new_credit(
                tenant_id,
                Uuid::new_v4(),
                2,
                "71.1".to_string(),
                dec!(50000),
                None,
                None,
                None,
            )
            .unwrap(),
        ],
        None,
    )
    .unwrap();

    let report = TrialBalanceCalculator::calculate_with_opening(
        &accounts,
        &[opening_entry],
        &[period_entry],
    );

    assert!(report.is_balanced);
    assert_eq!(report.total_opening_debit, dec!(100000));
    assert_eq!(report.total_opening_credit, dec!(100000));
    assert_eq!(report.total_period_debit, dec!(50000));
    assert_eq!(report.total_period_credit, dec!(50000));
    assert_eq!(report.total_closing_debit, dec!(150000));
    assert_eq!(report.total_closing_credit, dec!(150000));

    let row_caixa = report
        .rows
        .iter()
        .find(|r| r.account_code == "11.1")
        .unwrap();
    assert_eq!(row_caixa.opening_debit, dec!(100000));
    assert_eq!(row_caixa.period_debit, dec!(50000));
    assert_eq!(row_caixa.closing_debit, dec!(150000));
}

#[test]
fn test_saft_ao_generates_real_balances() {
    let tenant_id = Uuid::new_v4();
    let fiscal_year_id = Uuid::new_v4();
    let _journal_id = Uuid::new_v4();

    let acc_caixa = Account::new(
        tenant_id,
        "11.1".to_string(),
        Some("11".to_string()),
        "Caixa Geral".to_string(),
        Some(AccountNature::Debit),
        true,
        false,
        Some("111".to_string()),
    )
    .unwrap();

    let acc_vendas = Account::new(
        tenant_id,
        "71.1".to_string(),
        Some("71".to_string()),
        "Vendas".to_string(),
        Some(AccountNature::Credit),
        true,
        false,
        Some("711".to_string()),
    )
    .unwrap();

    let accounts = vec![acc_caixa, acc_vendas];
    let jrn = Journal::new(
        tenant_id,
        "CX".to_string(),
        "Caixa".to_string(),
        JournalType::Cash,
    )
    .unwrap();

    let entry = JournalEntry::new(
        tenant_id,
        fiscal_year_id,
        jrn.id,
        1,
        NaiveDate::from_ymd_opt(2026, 6, 1).unwrap(),
        6,
        "Venda em Numerário".to_string(),
        None,
        None,
        None,
        None,
        vec![
            JournalLine::new_debit(
                tenant_id,
                Uuid::new_v4(),
                1,
                "11.1".to_string(),
                dec!(45000),
                None,
                None,
                None,
            )
            .unwrap(),
            JournalLine::new_credit(
                tenant_id,
                Uuid::new_v4(),
                2,
                "71.1".to_string(),
                dec!(45000),
                None,
                None,
                None,
            )
            .unwrap(),
        ],
        None,
    )
    .unwrap();

    let xml = SaftAccountingGenerator::generate_xml(
        tenant_id,
        "Kudiba Test Corp",
        "5400000000",
        2026,
        NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
        NaiveDate::from_ymd_opt(2026, 12, 31).unwrap(),
        &accounts,
        &[jrn],
        &[entry],
    );

    assert!(xml.contains("<ClosingDebitBalance>45000.00</ClosingDebitBalance>"));
    assert!(xml.contains("<ClosingCreditBalance>45000.00</ClosingCreditBalance>"));
}

#[tokio::test]
async fn test_year_end_closing_classe_8_apuramento() {
    use kudiba_accounting::application::commands::CloseFiscalYearHandler;

    let tenant_id = Uuid::new_v4();
    let account_repo = Arc::new(MockAccountRepository::default());
    let year_repo = Arc::new(MockFiscalYearRepository::default());
    let jrn_repo = Arc::new(MockJournalRepository::default());
    let entry_repo = Arc::new(MockJournalEntryRepository::default());

    let seed_pgc = SeedStandardPgcHandler::new(account_repo.clone());
    let open_year = OpenFiscalYearHandler::new(year_repo.clone());
    let post_entry = PostManualEntryHandler::new(
        entry_repo.clone(),
        jrn_repo.clone(),
        year_repo.clone(),
        account_repo.clone(),
    );
    let close_year =
        CloseFiscalYearHandler::new(year_repo.clone(), entry_repo.clone(), jrn_repo.clone());

    seed_pgc.execute(tenant_id).await.unwrap();
    open_year
        .execute(tenant_id, CreateFiscalYearRequest { year_code: 2026 })
        .await
        .unwrap();

    let jrn = Journal::new(
        tenant_id,
        "OD".to_string(),
        "Operações Diversas".to_string(),
        JournalType::Operations,
    )
    .unwrap();
    jrn_repo.save(&jrn).await.unwrap();

    // 1. Registo de Proveitos (Vendas: 100.000 em 71.1)
    post_entry
        .execute(
            tenant_id,
            PostManualEntryRequest {
                fiscal_year: 2026,
                journal_code: "OD".to_string(),
                transaction_date: NaiveDate::from_ymd_opt(2026, 7, 10).unwrap(),
                period: 7,
                description: "Vendas de Mercadorias".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "11.1".to_string(),
                        description: Some("Caixa".to_string()),
                        debit_amount: Some(dec!(100000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: Some("Vendas".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(100000)),
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

    // 2. Registo de Custos (FSE: 40.000 em 62.1)
    post_entry
        .execute(
            tenant_id,
            PostManualEntryRequest {
                fiscal_year: 2026,
                journal_code: "OD".to_string(),
                transaction_date: NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(),
                period: 8,
                description: "Consumo de Eletricidade".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "62.1".to_string(),
                        description: Some("Eletricidade".to_string()),
                        debit_amount: Some(dec!(40000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "11.1".to_string(),
                        description: Some("Caixa".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(40000)),
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

    // 3. Executar o Fecho do Exercício
    let closed_year = close_year.execute(tenant_id, 2026).await.unwrap();
    assert_eq!(closed_year.status, FiscalYearStatus::Closed);

    // 4. Verificar se o lançamento de fecho foi gerado no período 14
    let entries = entry_repo
        .list_entries(tenant_id, None, None, None, 100, 0)
        .await
        .unwrap();
    let closing_entry = entries.iter().find(|e| e.period == 14);
    assert!(closing_entry.is_some());

    let fecho = closing_entry.unwrap();
    assert_eq!(fecho.total_debit, fecho.total_credit);
    assert!(fecho
        .description
        .contains("Apuramento e Encerramento de Resultados"));
}

#[tokio::test]
async fn test_currency_revaluation_favorable_and_unfavorable() {
    use kudiba_accounting::application::commands::RevalueCurrencyBalancesHandler;
    use kudiba_accounting::application::dto::CurrencyRevaluationRequest;
    use kudiba_accounting::domain::value_objects::Currency;

    let tenant_id = Uuid::new_v4();
    let account_repo = Arc::new(MockAccountRepository::default());
    let year_repo = Arc::new(MockFiscalYearRepository::default());
    let journal_repo = Arc::new(MockJournalRepository::default());
    let entry_repo = Arc::new(MockJournalEntryRepository::default());

    let seed_pgc = SeedStandardPgcHandler::new(account_repo.clone());
    let open_year = OpenFiscalYearHandler::new(year_repo.clone());
    let revaluation_handler = RevalueCurrencyBalancesHandler::new(
        account_repo.clone(),
        entry_repo.clone(),
        journal_repo.clone(),
        year_repo.clone(),
    );

    seed_pgc.execute(tenant_id).await.unwrap();
    open_year
        .execute(tenant_id, CreateFiscalYearRequest { year_code: 2026 })
        .await
        .unwrap();

    // Criar conta bancária analítica em USD (43.1.2)
    account_repo
        .save(
            &Account::new(
                tenant_id,
                "43.1.2".to_string(),
                Some("43.1".to_string()),
                "Banco BAI Moeda Estrangeira USD".to_string(),
                Some(AccountNature::Debit),
                true,
                false,
                Some("4312".to_string()),
            )
            .unwrap(),
        )
        .await
        .unwrap();

    // 1. Revalorização com Ganho Cambial (+50.000 Kz)
    let gain_req = CurrencyRevaluationRequest {
        fiscal_year: 2026,
        period: 12,
        revaluation_date: NaiveDate::from_ymd_opt(2026, 12, 31).unwrap(),
        target_account_code: "43.1.2".to_string(),
        currency: Currency::Usd,
        foreign_balance: dec!(1000),
        new_exchange_rate: dec!(950),
        previous_book_value_kz: dec!(900000),
        notes: Some("Ajustamento cambial de fecho".to_string()),
    };

    let gain_res = revaluation_handler
        .execute(tenant_id, gain_req, None)
        .await
        .unwrap();
    assert!(gain_res.is_gain);
    assert_eq!(gain_res.exchange_difference, dec!(50000));
    assert_eq!(gain_res.offset_account_code, "75.3");
    assert_eq!(gain_res.new_book_value_kz, dec!(950000));

    // 2. Revalorização com Perda Cambial (-100.000 Kz)
    let loss_req = CurrencyRevaluationRequest {
        fiscal_year: 2026,
        period: 12,
        revaluation_date: NaiveDate::from_ymd_opt(2026, 12, 31).unwrap(),
        target_account_code: "43.1.2".to_string(),
        currency: Currency::Usd,
        foreign_balance: dec!(1000),
        new_exchange_rate: dec!(850),
        previous_book_value_kz: dec!(950000),
        notes: Some("Ajustamento cambial desfavorável".to_string()),
    };

    let loss_res = revaluation_handler
        .execute(tenant_id, loss_req, None)
        .await
        .unwrap();
    assert!(!loss_res.is_gain);
    assert_eq!(loss_res.exchange_difference, dec!(-100000));
    assert_eq!(loss_res.offset_account_code, "66.3");
    assert_eq!(loss_res.new_book_value_kz, dec!(850000));

    // Verificar se os lançamentos foram gerados em partidas dobradas perfeitamente equilibradas
    let entries = entry_repo
        .list_entries(tenant_id, None, None, None, 100, 0)
        .await
        .unwrap();
    assert_eq!(entries.len(), 2);
    for e in entries {
        assert_eq!(e.total_debit, e.total_credit);
        assert_eq!(e.status, EntryStatus::Posted);
    }
}

#[tokio::test]
async fn test_payroll_period_closed_accounting_entry() {
    let tenant_id = Uuid::new_v4();
    let fiscal_year_id = Uuid::new_v4();
    let journal_id = Uuid::new_v4();

    // Valores do fechamento salarial:
    // Salário Ilíquido (63.1): 2.510.000,00 Kz
    // INSS 8% Patronal (63.2):    186.400,00 Kz
    // Salário Líquido (36.1):  2.053.645,50 Kz
    // IRT a Entregar (34.1):     386.454,50 Kz
    // INSS Total 11% (34.3):     256.300,00 Kz (69.900 trabalhador + 186.400 patronal)
    let total_gross = dec!(2510000.00);
    let total_net = dec!(2053645.50);
    let total_inss_employee = dec!(69900.00);
    let total_inss_employer = dec!(186400.00);
    let total_irt = dec!(386454.50);

    let entry = AccountingRulesService::create_payroll_entry(
        tenant_id,
        fiscal_year_id,
        journal_id,
        1,
        NaiveDate::from_ymd_opt(2026, 3, 31).unwrap(),
        3,
        "Folha Salarial - Março 2026",
        total_gross,
        total_net,
        total_inss_employee,
        total_inss_employer,
        total_irt,
    )
    .expect("Falha ao gerar lançamento contabilístico de folha salarial");

    // Partidas dobradas equilibradas
    assert_eq!(entry.total_debit, entry.total_credit);
    assert_eq!(entry.total_debit, dec!(2696400.00));
    assert_eq!(entry.lines.len(), 5);

    // D: 63.1.1 (2.510.000,00)
    assert_eq!(entry.lines[0].account_code, "63.1.1");
    assert_eq!(entry.lines[0].debit_amount, total_gross);

    // D: 63.2.1 (186.400,00)
    assert_eq!(entry.lines[1].account_code, "63.2.1");
    assert_eq!(entry.lines[1].debit_amount, total_inss_employer);

    // C: 36.1.1 (2.053.645,50)
    assert_eq!(entry.lines[2].account_code, "36.1.1");
    assert_eq!(entry.lines[2].credit_amount, total_net);

    // C: 34.1.1 (386.454,50)
    assert_eq!(entry.lines[3].account_code, "34.1.1");
    assert_eq!(entry.lines[3].credit_amount, total_irt);

    // C: 34.3.1 (256.300,00 = 69.900 + 186.400)
    assert_eq!(entry.lines[4].account_code, "34.3.1");
    assert_eq!(
        entry.lines[4].credit_amount,
        total_inss_employee + total_inss_employer
    );
}

#[tokio::test]
async fn test_payroll_period_amqp_event_parsing() {
    use kudiba_accounting::infrastructure::events::{AccountingEvent, AccountingEventConsumer};

    let tenant_id = Uuid::new_v4();
    let json_payload = serde_json::json!({
        "event_id": Uuid::new_v4().to_string(),
        "tenant_id": tenant_id.to_string(),
        "event_type": "payroll.period.closed",
        "payload": {
            "periodTitle": "Folha Salarial - Março 2026",
            "year": 2026,
            "month": 3,
            "totalGross": "2510000.00",
            "totalNet": "2053645.50",
            "totalInssEmployee": "69900.00",
            "totalInssEmployer": "186400.00",
            "totalIrt": "386454.50",
            "employeeCount": 3
        }
    });

    let raw_bytes = serde_json::to_vec(&json_payload).unwrap();
    let event = AccountingEventConsumer::parse_incoming_event(&raw_bytes)
        .expect("Deveria desserializar com sucesso o evento payroll.period.closed");

    match event {
        AccountingEvent::PayrollPeriodClosed {
            tenant_id: t_id,
            period_title,
            year,
            month,
            total_gross,
            total_net,
            total_inss_employee,
            total_inss_employer,
            total_irt,
            employee_count,
            ..
        } => {
            assert_eq!(t_id, tenant_id);
            assert_eq!(period_title, "Folha Salarial - Março 2026");
            assert_eq!(year, 2026);
            assert_eq!(month, 3);
            assert_eq!(total_gross, dec!(2510000.00));
            assert_eq!(total_net, dec!(2053645.50));
            assert_eq!(total_inss_employee, dec!(69900.00));
            assert_eq!(total_inss_employer, dec!(186400.00));
            assert_eq!(total_irt, dec!(386454.50));
            assert_eq!(employee_count, 3);
        }
        _ => panic!("Esperado AccountingEvent::PayrollPeriodClosed"),
    }
}

#[tokio::test]
async fn test_manual_entry_edit_use_case() {
    use kudiba_accounting::application::commands::{ReverseEntryHandler, UpdateEntryHandler};
    use kudiba_accounting::application::dto::{ReverseEntryRequest, UpdateEntryRequest};

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
    let update_entry =
        UpdateEntryHandler::new(entry_repo.clone(), year_repo.clone(), acc_repo.clone());
    let reverse_entry =
        ReverseEntryHandler::new(entry_repo.clone(), jrn_repo.clone(), year_repo.clone());

    seed_pgc.execute(tenant_id).await.unwrap();
    open_year
        .execute(tenant_id, CreateFiscalYearRequest { year_code: 2026 })
        .await
        .unwrap();

    let jrn = Journal::new(
        tenant_id,
        "OD".to_string(),
        "Operações Diversas".to_string(),
        JournalType::Operations,
    )
    .unwrap();
    jrn_repo.save(&jrn).await.unwrap();

    let entry = post_entry
        .execute(
            tenant_id,
            PostManualEntryRequest {
                fiscal_year: 2026,
                journal_code: "OD".to_string(),
                transaction_date: NaiveDate::from_ymd_opt(2026, 3, 5).unwrap(),
                period: 3,
                description: "Fatura FT 2026/001 - IVA liquidado a 100%".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "31.1.1".to_string(),
                        description: Some("Cliente nacional".to_string()),
                        debit_amount: Some(dec!(114000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: Some("Venda de mercadorias".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(100000)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "34.5.3.1".to_string(),
                        description: Some("IVA liquidado 14%".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(14000)),
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

    // 1. Edição válida: empresa paga metade do IVA e cativa a outra metade em 34.5.5
    let edited = update_entry
        .execute(
            tenant_id,
            entry.id,
            UpdateEntryRequest {
                transaction_date: NaiveDate::from_ymd_opt(2026, 3, 6).unwrap(),
                period: 3,
                description: "Fatura FT 2026/001 - IVA liquidado a 50%, restante a regularizar"
                    .to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "31.1.1".to_string(),
                        description: Some("Cliente nacional".to_string()),
                        debit_amount: Some(dec!(114000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: Some("Venda de mercadorias".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(100000)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "34.5.3.1".to_string(),
                        description: Some("IVA liquidado 14% (50%)".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(7000)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "34.5.5".to_string(),
                        description: Some("IVA a regularizar (50%)".to_string()),
                        debit_amount: None,
                        credit_amount: Some(dec!(7000)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                ],
            },
        )
        .await
        .unwrap();

    assert_eq!(edited.id, entry.id);
    assert_eq!(edited.entry_number, entry.entry_number);
    assert_eq!(
        edited.transaction_date,
        NaiveDate::from_ymd_opt(2026, 3, 6).unwrap()
    );
    assert_eq!(edited.total_debit, dec!(114000));
    assert_eq!(edited.total_credit, dec!(114000));
    assert_eq!(edited.lines.len(), 4);
    assert!(edited.source_document_ref.is_none());

    let stored = entry_repo
        .find_by_id(tenant_id, entry.id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.lines.len(), 4);
    assert!(stored
        .lines
        .iter()
        .any(|l| l.account_code == "34.5.5" && l.credit_amount == dec!(7000)));

    // 2. Edição com partidas desequilibradas é rejeitada
    let err = update_entry
        .execute(
            tenant_id,
            entry.id,
            UpdateEntryRequest {
                transaction_date: NaiveDate::from_ymd_opt(2026, 3, 6).unwrap(),
                period: 3,
                description: "Desequilibrado".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "12.1".to_string(),
                        description: None,
                        debit_amount: Some(dec!(1000)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: None,
                        debit_amount: None,
                        credit_amount: Some(dec!(900)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                ],
            },
        )
        .await
        .unwrap_err();
    assert!(matches!(err, DomainError::UnbalancedEntry(_, _)));

    // 3. Exercício fiscal fechado impede edição
    let mut year = year_repo
        .find_by_year(tenant_id, 2026)
        .await
        .unwrap()
        .unwrap();
    year.status = FiscalYearStatus::Closed;
    year_repo.update(&year).await.unwrap();

    let err = update_entry
        .execute(
            tenant_id,
            entry.id,
            UpdateEntryRequest {
                transaction_date: NaiveDate::from_ymd_opt(2026, 3, 6).unwrap(),
                period: 3,
                description: "Editar com ano fechado".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "12.1".to_string(),
                        description: None,
                        debit_amount: Some(dec!(100)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: None,
                        debit_amount: None,
                        credit_amount: Some(dec!(100)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                ],
            },
        )
        .await
        .unwrap_err();
    assert!(matches!(err, DomainError::InvalidFiscalYear(_)));

    // 4. Lançamento estornado não pode ser editado
    year.status = FiscalYearStatus::Open;
    year_repo.update(&year).await.unwrap();

    reverse_entry
        .execute(
            tenant_id,
            ReverseEntryRequest {
                entry_id: entry.id,
                reversal_date: NaiveDate::from_ymd_opt(2026, 3, 10).unwrap(),
                period: 3,
                reason: "Documento emitido por engano".to_string(),
            },
        )
        .await
        .unwrap();

    let err = update_entry
        .execute(
            tenant_id,
            entry.id,
            UpdateEntryRequest {
                transaction_date: NaiveDate::from_ymd_opt(2026, 3, 6).unwrap(),
                period: 3,
                description: "Editar estornado".to_string(),
                lines: vec![
                    ManualLineRequest {
                        account_code: "12.1".to_string(),
                        description: None,
                        debit_amount: Some(dec!(100)),
                        credit_amount: None,
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                    ManualLineRequest {
                        account_code: "71.1".to_string(),
                        description: None,
                        debit_amount: None,
                        credit_amount: Some(dec!(100)),
                        entity_id: None,
                        cost_center_id: None,
                        currency: None,
                    },
                ],
            },
        )
        .await
        .unwrap_err();
    assert!(matches!(err, DomainError::ValidationError(_)));
}
