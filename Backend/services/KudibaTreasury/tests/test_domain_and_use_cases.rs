use async_trait::async_trait;
use rust_decimal_macros::dec;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use kudiba_treasury::application::commands::{
    CloseCashSessionHandler, CreateBankAccountHandler, CreateCashRegisterHandler,
    IssueTreasuryReceiptHandler, OpenCashSessionHandler, RecordCashMovementHandler,
};
use kudiba_treasury::application::dto::{
    CloseCashSessionRequest, CreateBankAccountRequest, CreateCashRegisterRequest,
    IssueTreasuryReceiptRequest, OpenCashSessionRequest, ReceiptLineRequest,
    RecordCashMovementRequest,
};
use kudiba_treasury::application::queries::TreasuryQueries;
use kudiba_treasury::domain::entities::{
    BankAccount, CashMovement, CashRegister, CashSession, TreasuryReceipt, TreasuryReceiptLine,
};
use kudiba_treasury::domain::error::DomainError;
use kudiba_treasury::domain::ports::{
    BankAccountRepository, CashMovementRepository, CashRegisterRepository, CashSessionRepository,
    TreasuryReceiptRepository,
};
use kudiba_treasury::domain::services::{DiscrepancyType, ReconciliationService};
use kudiba_treasury::domain::value_objects::{
    Currency, MovementType, PaymentMethod, SessionStatus,
};

#[test]
fn test_cash_register_lifecycle() {
    let tenant_id = Uuid::new_v4();
    let register = CashRegister::new(
        tenant_id,
        None,
        "CX-01".to_string(),
        "Caixa Principal".to_string(),
    )
    .expect("Falha ao criar caixa válido");

    assert_eq!(register.code, "CX-01");
    assert_eq!(register.name, "Caixa Principal");
    assert!(register.is_active);

    let empty_code = CashRegister::new(tenant_id, None, "   ".to_string(), "Caixa".to_string());
    assert!(empty_code.is_err());

    let empty_name = CashRegister::new(tenant_id, None, "CX-02".to_string(), "   ".to_string());
    assert!(empty_name.is_err());

    let mut reg = register;
    reg.deactivate();
    assert!(!reg.is_active);
    reg.activate();
    assert!(reg.is_active);
}

#[test]
fn test_cash_session_lifecycle_and_reconciliation() {
    let tenant_id = Uuid::new_v4();
    let register_id = Uuid::new_v4();

    let negative_session =
        CashSession::open(tenant_id, register_id, "op-001".to_string(), dec!(-100));
    assert!(negative_session.is_err());

    let empty_op = CashSession::open(tenant_id, register_id, "  ".to_string(), dec!(5000));
    assert!(empty_op.is_err());

    let mut session = CashSession::open(tenant_id, register_id, "op-001".to_string(), dec!(10000))
        .expect("Falha ao abrir sessão");

    assert_eq!(session.status, SessionStatus::Open);
    assert_eq!(session.opening_balance, dec!(10000));

    let movements = vec![
        CashMovement::new(
            tenant_id,
            session.id,
            register_id,
            MovementType::Supply,
            dec!(5000),
            "Fundo extra".to_string(),
            "op-001".to_string(),
        )
        .unwrap(),
        CashMovement::new(
            tenant_id,
            session.id,
            register_id,
            MovementType::SaleReceipt,
            dec!(20000),
            "Venda dinheiro".to_string(),
            "op-001".to_string(),
        )
        .unwrap(),
        CashMovement::new(
            tenant_id,
            session.id,
            register_id,
            MovementType::Bleed,
            dec!(8000),
            "Sangria cofre".to_string(),
            "op-001".to_string(),
        )
        .unwrap(),
        CashMovement::new(
            tenant_id,
            session.id,
            register_id,
            MovementType::Expense,
            dec!(2000),
            "Material limpeza".to_string(),
            "op-001".to_string(),
        )
        .unwrap(),
    ];

    let (sup, sale, bleed, exp, expected) =
        ReconciliationService::calculate_system_balance(session.opening_balance, &movements);

    assert_eq!(sup, dec!(5000));
    assert_eq!(sale, dec!(20000));
    assert_eq!(bleed, dec!(8000));
    assert_eq!(exp, dec!(2000));
    // 10000 + 5000 + 20000 - 8000 - 2000 = 25000
    assert_eq!(expected, dec!(25000));

    // Contagem cega exacta
    let recon_exact =
        ReconciliationService::reconcile(session.opening_balance, &movements, Some(dec!(25000)));
    assert_eq!(recon_exact.discrepancy, Some(dec!(0)));
    assert_eq!(recon_exact.discrepancy_type, Some(DiscrepancyType::Exact));

    // Contagem cega com sobra
    let recon_surplus =
        ReconciliationService::reconcile(session.opening_balance, &movements, Some(dec!(26000)));
    assert_eq!(recon_surplus.discrepancy, Some(dec!(1000)));
    assert_eq!(
        recon_surplus.discrepancy_type,
        Some(DiscrepancyType::Surplus)
    );

    // Contagem cega com quebra / faltante
    let recon_shortage =
        ReconciliationService::reconcile(session.opening_balance, &movements, Some(dec!(23500)));
    assert_eq!(recon_shortage.discrepancy, Some(dec!(-1500)));
    assert_eq!(
        recon_shortage.discrepancy_type,
        Some(DiscrepancyType::Shortage)
    );

    // Fecho da sessão
    session
        .close(dec!(25000), expected, Some("Fecho sem desvios".to_string()))
        .expect("Falha ao fechar sessão");

    assert_eq!(session.status, SessionStatus::Closed);
    assert!(session.closed_at.is_some());
    assert_eq!(session.closing_balance_counted, Some(dec!(25000)));
    assert_eq!(session.closing_balance_system, Some(dec!(25000)));
    assert_eq!(session.discrepancy, Some(dec!(0)));

    // Re-fecho de sessão fechada deve falhar
    assert!(session.close(dec!(25000), expected, None).is_err());
}

#[test]
fn test_bank_account_credits_debits_and_iban_validation() {
    let tenant_id = Uuid::new_v4();
    let invalid_iban = BankAccount::new(
        tenant_id,
        "Banco BAI".to_string(),
        "123456789".to_string(),
        "123".to_string(),
        Currency::AOA,
        dec!(0),
    );
    assert!(invalid_iban.is_err());

    let mut account = BankAccount::new(
        tenant_id,
        "Banco BAI".to_string(),
        "123456789".to_string(),
        "AO06004000001234567890123".to_string(),
        Currency::AOA,
        dec!(50000),
    )
    .expect("Falha ao criar conta bancária");

    assert_eq!(account.current_balance, dec!(50000));

    // Crédito
    account.credit(dec!(25000)).unwrap();
    assert_eq!(account.current_balance, dec!(75000));

    // Débito válido
    account.debit(dec!(30000)).unwrap();
    assert_eq!(account.current_balance, dec!(45000));

    // Débito excessivo (saldo insuficiente)
    let overdraft = account.debit(dec!(50000));
    assert!(matches!(overdraft, Err(DomainError::InsufficientFunds(_))));
    assert_eq!(account.current_balance, dec!(45000));
}

#[test]
fn test_treasury_receipt_validation() {
    let tenant_id = Uuid::new_v4();
    let receipt_id = Uuid::new_v4();

    let lines = vec![
        TreasuryReceiptLine::new(
            receipt_id,
            "inv-01".to_string(),
            "FT 2026/001".to_string(),
            dec!(30000),
            None,
        )
        .unwrap(),
        TreasuryReceiptLine::new(
            receipt_id,
            "inv-02".to_string(),
            "FT 2026/002".to_string(),
            dec!(20000),
            None,
        )
        .unwrap(),
    ];

    // Total confere com as linhas (50000)
    let receipt = TreasuryReceipt::new(
        tenant_id,
        "RC 2026/0001".to_string(),
        "cust-001".to_string(),
        "Empresa ABC Lda".to_string(),
        Some("5000000000".to_string()),
        None,
        None,
        PaymentMethod::Transferencia,
        dec!(50000),
        Currency::AOA,
        Some("Liquidação de faturas em aberto".to_string()),
        lines.clone(),
    );
    assert!(receipt.is_ok());

    // Soma das linhas não bate com total_amount
    let mismatch = TreasuryReceipt::new(
        tenant_id,
        "RC 2026/0002".to_string(),
        "cust-001".to_string(),
        "Empresa ABC Lda".to_string(),
        None,
        None,
        None,
        PaymentMethod::Transferencia,
        dec!(40000), // Diferente de 50000!
        Currency::AOA,
        None,
        lines,
    );
    assert!(matches!(mismatch, Err(DomainError::ValidationError(_))));
}

// =============================================================================
// Testes de Aplicação com Repositórios em Memória
// =============================================================================

#[derive(Default)]
struct MockCashRegisterRepository {
    items: Mutex<HashMap<(Uuid, String), CashRegister>>,
}

#[async_trait]
impl CashRegisterRepository for MockCashRegisterRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashRegister>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|r| r.tenant_id == tenant_id && r.id == id)
            .cloned())
    }

    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<CashRegister>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock.get(&(tenant_id, code.to_uppercase())).cloned())
    }

    async fn list(&self, tenant_id: Uuid) -> Result<Vec<CashRegister>, DomainError> {
        let lock = self.items.lock().unwrap();
        let mut list: Vec<_> = lock
            .values()
            .filter(|r| r.tenant_id == tenant_id)
            .cloned()
            .collect();
        list.sort_by(|a, b| a.code.cmp(&b.code));
        Ok(list)
    }

    async fn save(&self, register: &CashRegister) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(
            (register.tenant_id, register.code.clone()),
            register.clone(),
        );
        Ok(())
    }

    async fn update(&self, register: &CashRegister) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(
            (register.tenant_id, register.code.clone()),
            register.clone(),
        );
        Ok(())
    }
}

#[derive(Default)]
struct MockCashSessionRepository {
    items: Mutex<HashMap<Uuid, CashSession>>,
}

#[async_trait]
impl CashSessionRepository for MockCashSessionRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashSession>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|s| s.tenant_id == tenant_id && s.id == id)
            .cloned())
    }

    async fn find_open_session_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
    ) -> Result<Option<CashSession>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|s| {
                s.tenant_id == tenant_id
                    && s.register_id == register_id
                    && s.status == SessionStatus::Open
            })
            .cloned())
    }

    async fn list_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
        _limit: i64,
    ) -> Result<Vec<CashSession>, DomainError> {
        let lock = self.items.lock().unwrap();
        let list: Vec<_> = lock
            .values()
            .filter(|s| s.tenant_id == tenant_id && s.register_id == register_id)
            .cloned()
            .collect();
        Ok(list)
    }

    async fn save(&self, session: &CashSession) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(session.id, session.clone());
        Ok(())
    }

    async fn update(&self, session: &CashSession) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(session.id, session.clone());
        Ok(())
    }
}

#[derive(Default)]
struct MockCashMovementRepository {
    items: Mutex<Vec<CashMovement>>,
}

#[async_trait]
impl CashMovementRepository for MockCashMovementRepository {
    async fn save(&self, movement: &CashMovement) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.push(movement.clone());
        Ok(())
    }

    async fn list_by_session(
        &self,
        tenant_id: Uuid,
        session_id: Uuid,
    ) -> Result<Vec<CashMovement>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .iter()
            .filter(|m| m.tenant_id == tenant_id && m.session_id == session_id)
            .cloned()
            .collect())
    }
}

#[derive(Default)]
struct MockBankAccountRepository {
    items: Mutex<HashMap<Uuid, BankAccount>>,
}

#[async_trait]
impl BankAccountRepository for MockBankAccountRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<BankAccount>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|b| b.tenant_id == tenant_id && b.id == id)
            .cloned())
    }

    async fn find_by_iban(
        &self,
        tenant_id: Uuid,
        iban: &str,
    ) -> Result<Option<BankAccount>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|b| b.tenant_id == tenant_id && b.iban == iban)
            .cloned())
    }

    async fn list(&self, tenant_id: Uuid) -> Result<Vec<BankAccount>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .filter(|b| b.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn save(&self, account: &BankAccount) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(account.id, account.clone());
        Ok(())
    }

    async fn update(&self, account: &BankAccount) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(account.id, account.clone());
        Ok(())
    }
}

#[derive(Default)]
struct MockTreasuryReceiptRepository {
    items: Mutex<HashMap<Uuid, TreasuryReceipt>>,
}

#[async_trait]
impl TreasuryReceiptRepository for MockTreasuryReceiptRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<TreasuryReceipt>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|r| r.tenant_id == tenant_id && r.id == id)
            .cloned())
    }

    async fn find_by_number(
        &self,
        tenant_id: Uuid,
        number: &str,
    ) -> Result<Option<TreasuryReceipt>, DomainError> {
        let lock = self.items.lock().unwrap();
        Ok(lock
            .values()
            .find(|r| r.tenant_id == tenant_id && r.receipt_number == number)
            .cloned())
    }

    async fn list(
        &self,
        tenant_id: Uuid,
        customer_id: Option<&str>,
        _limit: i64,
    ) -> Result<Vec<TreasuryReceipt>, DomainError> {
        let lock = self.items.lock().unwrap();
        let list: Vec<_> = lock
            .values()
            .filter(|r| {
                r.tenant_id == tenant_id
                    && (customer_id.is_none() || r.customer_id == customer_id.unwrap())
            })
            .cloned()
            .collect();
        Ok(list)
    }

    async fn next_receipt_number(
        &self,
        _tenant_id: Uuid,
        year: i32,
    ) -> Result<String, DomainError> {
        let lock = self.items.lock().unwrap();
        let count = lock.len() + 1;
        Ok(format!("RC {}/{:04}", year, count))
    }

    async fn save(&self, receipt: &TreasuryReceipt) -> Result<(), DomainError> {
        let mut lock = self.items.lock().unwrap();
        lock.insert(receipt.id, receipt.clone());
        Ok(())
    }
}

#[tokio::test]
async fn test_full_application_use_case_flow() {
    let tenant_id = Uuid::new_v4();

    let reg_repo = Arc::new(MockCashRegisterRepository::default());
    let sess_repo = Arc::new(MockCashSessionRepository::default());
    let mov_repo = Arc::new(MockCashMovementRepository::default());
    let bank_repo = Arc::new(MockBankAccountRepository::default());
    let rec_repo = Arc::new(MockTreasuryReceiptRepository::default());

    let create_reg = CreateCashRegisterHandler::new(reg_repo.clone());
    let open_sess = OpenCashSessionHandler::new(reg_repo.clone(), sess_repo.clone());
    let close_sess = CloseCashSessionHandler::new(sess_repo.clone(), mov_repo.clone());
    let record_mov = RecordCashMovementHandler::new(sess_repo.clone(), mov_repo.clone());
    let create_bank = CreateBankAccountHandler::new(bank_repo.clone());
    let issue_receipt = IssueTreasuryReceiptHandler::new(
        rec_repo.clone(),
        sess_repo.clone(),
        mov_repo.clone(),
        bank_repo.clone(),
    );
    let queries = TreasuryQueries::new(
        reg_repo.clone(),
        sess_repo.clone(),
        mov_repo.clone(),
        bank_repo.clone(),
        rec_repo.clone(),
    );

    // 1. Criar Caixa
    let register = create_reg
        .execute(
            tenant_id,
            CreateCashRegisterRequest {
                branch_id: None,
                code: "CX-01".to_string(),
                name: "Caixa Central".to_string(),
            },
        )
        .await
        .expect("Falha ao criar caixa");

    assert_eq!(register.code, "CX-01");

    // Tentativa de duplicar código deve falhar
    let dup_reg = create_reg
        .execute(
            tenant_id,
            CreateCashRegisterRequest {
                branch_id: None,
                code: "cx-01".to_string(),
                name: "Outro".to_string(),
            },
        )
        .await;
    assert!(matches!(dup_reg, Err(DomainError::AlreadyExists(_))));

    // 2. Abrir Sessão de Caixa
    let session = open_sess
        .execute(
            tenant_id,
            OpenCashSessionRequest {
                register_id: register.id,
                operator_user_id: "usr-operator-01".to_string(),
                opening_balance: dec!(10000),
            },
        )
        .await
        .expect("Falha ao abrir sessão");

    assert_eq!(session.status, SessionStatus::Open);
    assert_eq!(session.opening_balance, dec!(10000));

    // Abrir segunda sessão no mesmo caixa deve falhar
    let dup_session = open_sess
        .execute(
            tenant_id,
            OpenCashSessionRequest {
                register_id: register.id,
                operator_user_id: "usr-operator-02".to_string(),
                opening_balance: dec!(5000),
            },
        )
        .await;
    assert!(matches!(
        dup_session,
        Err(DomainError::InvalidSessionState(_))
    ));

    // 3. Movimento de Suprimento (Cash IN)
    let sup_mov = record_mov
        .execute(
            tenant_id,
            RecordCashMovementRequest {
                session_id: session.id,
                movement_type: MovementType::Supply,
                amount: dec!(5000),
                reason: "Troco adicional de moedas".to_string(),
                operator_user_id: "usr-operator-01".to_string(),
            },
        )
        .await
        .expect("Falha ao registar suprimento");
    assert_eq!(sup_mov.amount, dec!(5000));

    // 4. Movimento de Sangria (Cash OUT)
    let bleed_mov = record_mov
        .execute(
            tenant_id,
            RecordCashMovementRequest {
                session_id: session.id,
                movement_type: MovementType::Bleed,
                amount: dec!(4000),
                reason: "Transferência para cofre".to_string(),
                operator_user_id: "usr-operator-01".to_string(),
            },
        )
        .await
        .expect("Falha ao registar sangria");
    assert_eq!(bleed_mov.amount, dec!(4000));

    // Sangria acima do saldo disponível (saldo atual: 10000 + 5000 - 4000 = 11000)
    let excess_bleed = record_mov
        .execute(
            tenant_id,
            RecordCashMovementRequest {
                session_id: session.id,
                movement_type: MovementType::Bleed,
                amount: dec!(20000),
                reason: "Tentativa excessiva".to_string(),
                operator_user_id: "usr-operator-01".to_string(),
            },
        )
        .await;
    assert!(matches!(
        excess_bleed,
        Err(DomainError::InsufficientFunds(_))
    ));

    // 5. Criar Conta Bancária
    let bank_acc = create_bank
        .execute(
            tenant_id,
            CreateBankAccountRequest {
                bank_name: "Banco Angolano de Investimentos".to_string(),
                account_number: "0040.1234.5678".to_string(),
                iban: "AO06004000001234567890123".to_string(),
                currency: Currency::AOA,
                initial_balance: Some(dec!(100000)),
            },
        )
        .await
        .expect("Falha ao criar conta bancária");
    assert_eq!(bank_acc.current_balance, dec!(100000));

    // 6. Emitir Recibo de Quitação com pagamento em NUMERARIO (gera movimento no caixa!)
    let receipt_cash = issue_receipt
        .execute(
            tenant_id,
            IssueTreasuryReceiptRequest {
                customer_id: "cust-001".to_string(),
                customer_name: "Cliente Luanda Lda".to_string(),
                customer_nif: Some("5412345678".to_string()),
                session_id: Some(session.id),
                bank_account_id: None,
                payment_method: PaymentMethod::Numerario,
                total_amount: dec!(15000),
                currency: Currency::AOA,
                notes: Some("Liquidação em dinheiro no balcão".to_string()),
                lines: vec![ReceiptLineRequest {
                    invoice_id: "inv-uuid-1".to_string(),
                    invoice_number: "FT 2026/0010".to_string(),
                    amount_settled: dec!(15000),
                    notes: None,
                }],
            },
        )
        .await
        .expect("Falha ao emitir recibo a dinheiro");

    assert_eq!(receipt_cash.total_amount, dec!(15000));
    assert_eq!(receipt_cash.lines.len(), 1);

    // 7. Emitir Recibo de Quitação pago por TRANSFERÊNCIA (credita a conta bancária!)
    let receipt_bank = issue_receipt
        .execute(
            tenant_id,
            IssueTreasuryReceiptRequest {
                customer_id: "cust-002".to_string(),
                customer_name: "Distribuidora Viana Lda".to_string(),
                customer_nif: Some("5498765432".to_string()),
                session_id: None,
                bank_account_id: Some(bank_acc.id),
                payment_method: PaymentMethod::Transferencia,
                total_amount: dec!(50000),
                currency: Currency::AOA,
                notes: Some("Liquidação via transferência bancária".to_string()),
                lines: vec![
                    ReceiptLineRequest {
                        invoice_id: "inv-uuid-2".to_string(),
                        invoice_number: "FT 2026/0011".to_string(),
                        amount_settled: dec!(20000),
                        notes: None,
                    },
                    ReceiptLineRequest {
                        invoice_id: "inv-uuid-3".to_string(),
                        invoice_number: "FT 2026/0012".to_string(),
                        amount_settled: dec!(30000),
                        notes: None,
                    },
                ],
            },
        )
        .await
        .expect("Falha ao emitir recibo por transferência bancária");

    assert_eq!(receipt_bank.total_amount, dec!(50000));
    assert_eq!(receipt_bank.lines.len(), 2);

    // Saldo bancário após crédito: 100000 + 50000 = 150000
    let updated_bank = queries
        .get_bank_account(tenant_id, bank_acc.id)
        .await
        .unwrap();
    assert_eq!(updated_bank.current_balance, dec!(150000));

    // 8. Relatório da Sessão de Caixa antes do fecho
    // Saldo esperado em caixa = 10000 (abertura) + 5000 (suprimento) + 15000 (venda recibo) - 4000 (sangria) = 26000
    let report_before_close = queries
        .get_session_report(tenant_id, session.id)
        .await
        .unwrap();
    assert_eq!(
        report_before_close.reconciliation.expected_balance,
        dec!(26000)
    );
    assert_eq!(report_before_close.reconciliation.total_in, dec!(20000));
    assert_eq!(report_before_close.reconciliation.total_out, dec!(4000));

    // 9. Fecho Cego da Sessão com contagem de 26000 AOA
    let closed_session = close_sess
        .execute(
            tenant_id,
            session.id,
            CloseCashSessionRequest {
                closing_balance_counted: dec!(26000),
                notes: Some("Fecho do turno da tarde conferido pelo supervisor".to_string()),
            },
        )
        .await
        .expect("Falha ao fechar sessão");

    assert_eq!(closed_session.status, SessionStatus::Closed);
    assert_eq!(closed_session.closing_balance_counted, Some(dec!(26000)));
    assert_eq!(closed_session.closing_balance_system, Some(dec!(26000)));
    assert_eq!(closed_session.discrepancy, Some(dec!(0)));

    // 10. Consulta do Relatório Final após fecho
    let report_after = queries
        .get_session_report(tenant_id, session.id)
        .await
        .unwrap();
    assert_eq!(
        report_after.reconciliation.discrepancy_type,
        Some(DiscrepancyType::Exact)
    );
    assert_eq!(report_after.movements.len(), 3); // Suprimento, Sangria, Recibo
}
