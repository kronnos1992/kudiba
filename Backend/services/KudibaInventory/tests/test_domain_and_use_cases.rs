use rust_decimal_macros::dec;
use uuid::Uuid;

use kudiba_inventory::domain::entities::{Product, StockBalance};
use kudiba_inventory::domain::error::InventoryError;
use kudiba_inventory::domain::ports::InventoryEventPublisher;
use kudiba_inventory::domain::services::{CmpCalculator, StockPolicy};
use kudiba_inventory::domain::value_objects::{ProductType, TaxId, TaxIdKind};

#[derive(Default)]
struct MockInventoryEventPublisher {
    published: std::sync::Mutex<Vec<(Uuid, String, chrono::NaiveDate, rust_decimal::Decimal)>>,
}

#[async_trait::async_trait]
impl InventoryEventPublisher for MockInventoryEventPublisher {
    async fn publish_stock_dispatch(
        &self,
        tenant_id: Uuid,
        document_number: &str,
        movement_date: chrono::NaiveDate,
        total_cmp_cost: rust_decimal::Decimal,
    ) -> Result<(), InventoryError> {
        self.published.lock().unwrap().push((
            tenant_id,
            document_number.to_string(),
            movement_date,
            total_cmp_cost,
        ));
        Ok(())
    }
}

#[test]
fn test_validacao_nif_pessoa_coletiva_angolana() {
    let valid_nif = TaxId::new("5412345678", TaxIdKind::LegalEntity);
    assert!(valid_nif.is_ok());
    assert_eq!(valid_nif.unwrap().value(), "5412345678");

    let invalid_len = TaxId::new("541234567", TaxIdKind::LegalEntity);
    assert!(matches!(invalid_len, Err(InventoryError::InvalidTaxId(_))));

    let invalid_chars = TaxId::new("541234567A", TaxIdKind::LegalEntity);
    assert!(matches!(
        invalid_chars,
        Err(InventoryError::InvalidTaxId(_))
    ));
}

#[test]
fn test_validacao_bi_pessoa_singular_angolana() {
    let valid_bi = TaxId::new("000123456LA012", TaxIdKind::NaturalPersonBi);
    assert!(valid_bi.is_ok());

    let lowercase_bi = TaxId::new("000123456ha045", TaxIdKind::NaturalPersonBi);
    assert!(lowercase_bi.is_ok());
    assert_eq!(lowercase_bi.unwrap().value(), "000123456HA045");

    let invalid_format = TaxId::new("00012345678901", TaxIdKind::NaturalPersonBi);
    assert!(matches!(
        invalid_format,
        Err(InventoryError::InvalidTaxId(_))
    ));
}

#[test]
fn test_validacao_consumidor_final_e_estrangeiro() {
    let cf = TaxId::new("999999999", TaxIdKind::FinalConsumer);
    assert!(cf.is_ok());

    let cf_invalido = TaxId::new("999999990", TaxIdKind::FinalConsumer);
    assert!(matches!(cf_invalido, Err(InventoryError::InvalidTaxId(_))));

    let foreign = TaxId::new("PT501234567", TaxIdKind::Foreign);
    assert!(foreign.is_ok());
}

#[test]
fn test_calculo_cmp_sucessivas_compras() {
    // 1. Compra inicial: 100 unidades a 1000.00 AOA
    let cmp1 =
        CmpCalculator::calculate_new_cmp(dec!(0), dec!(0), dec!(100), dec!(1000.00)).unwrap();
    assert_eq!(cmp1, dec!(1000.0000));

    // 2. Segunda compra com preço mais alto: 50 unidades a 1300.00 AOA
    // (100 * 1000 + 50 * 1300) / 150 = (100.000 + 65.000) / 150 = 165.000 / 150 = 1100.00 AOA
    let cmp2 = CmpCalculator::calculate_new_cmp(dec!(100), cmp1, dec!(50), dec!(1300.00)).unwrap();
    assert_eq!(cmp2, dec!(1100.0000));

    // 3. Venda subsequente não altera o CMP unitário (apenas reduz quantidade)
    let saldo_apos_venda_40 = dec!(150) - dec!(40); // 110 unidades restantes
    assert_eq!(saldo_apos_venda_40, dec!(110));

    // 4. Terceira compra: 90 unidades a 900.00 AOA
    // (110 * 1100 + 90 * 900) / 200 = (121.000 + 81.000) / 200 = 202.000 / 200 = 1010.00 AOA
    let cmp3 = CmpCalculator::calculate_new_cmp(saldo_apos_venda_40, cmp2, dec!(90), dec!(900.00))
        .unwrap();
    assert_eq!(cmp3, dec!(1010.0000));
}

#[test]
fn test_regras_de_intangiveis_e_servicos() {
    let tenant_id = Uuid::new_v4();

    // Serviço de Software SaaS
    let service = Product::new(
        tenant_id,
        "SW-001".to_string(),
        None,
        "Subscrição Mensal ERP".to_string(),
        None,
        ProductType::Service,
        None, // is_stockable padrão false
        false,
        "MES".to_string(),
        dec!(50000),
        dec!(0),
        dec!(14),
        None,
        None,
        None,
    )
    .unwrap();

    assert!(!service.is_stockable);
    assert_eq!(service.product_type, ProductType::Service);
    assert!(service.has_withholding_tax); // 6.5% automático

    // Não pode movimentar stock
    assert!(matches!(
        StockPolicy::ensure_can_move_stock(&service),
        Err(InventoryError::IntangibleCannotMoveStock(_))
    ));

    // Não pode emitir Guia de Transporte
    assert!(matches!(
        StockPolicy::ensure_can_issue_cargo_document(&service),
        Err(InventoryError::IntangibleCannotHaveCargoDocument(_))
    ));
}

#[test]
fn test_regras_de_produtos_fisicos() {
    let tenant_id = Uuid::new_v4();

    let goods = Product::new(
        tenant_id,
        "FAR-001".to_string(),
        Some("5601112223334".to_string()),
        "Paracetamol 500mg Caixa".to_string(),
        None,
        ProductType::Goods,
        Some(true),
        true, // com lote
        "UN".to_string(),
        dec!(1200),
        dec!(700),
        dec!(14),
        None,
        None,
        None,
    )
    .unwrap();

    assert!(goods.is_stockable);
    assert!(goods.track_lots);
    assert!(!goods.has_withholding_tax); // Venda física não retém 6.5%

    assert!(StockPolicy::ensure_can_move_stock(&goods).is_ok());
    assert!(StockPolicy::ensure_can_issue_cargo_document(&goods).is_ok());
}

#[test]
fn test_reservas_e_saldos_em_stock_balance() {
    let mut balance = StockBalance::new(
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
        Some(dec!(10)),
    );

    // Entrada de 50
    assert!(balance.apply_addition(dec!(50)).is_ok());
    assert_eq!(balance.quantity_on_hand, dec!(50));
    assert_eq!(balance.available_quantity(), dec!(50));

    // Reserva de 20 no POS
    assert!(balance.reserve(dec!(20)).is_ok());
    assert_eq!(balance.quantity_reserved, dec!(20));
    assert_eq!(balance.available_quantity(), dec!(30));

    // Tentar reservar 35 (só há 30 disponível) -> deve falhar
    assert!(balance.reserve(dec!(35)).is_err());

    // Deduzir 20 reservado ao emitir fatura
    assert!(balance.apply_deduction(dec!(20), true).is_ok());
    assert_eq!(balance.quantity_on_hand, dec!(30));
    assert_eq!(balance.quantity_reserved, dec!(0));
    assert_eq!(balance.available_quantity(), dec!(30));
}

#[test]
fn test_criacao_e_validacao_de_lotes() {
    use chrono::NaiveDate;
    use kudiba_inventory::domain::entities::ProductBatch;

    let tenant_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let mfg = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
    let exp = NaiveDate::from_ymd_opt(2026, 12, 31).unwrap();

    let batch = ProductBatch::new(
        tenant_id,
        product_id,
        "LOT-2026-001".to_string(),
        Some(mfg),
        Some(exp),
    );
    assert!(batch.is_ok());
    let b = batch.unwrap();
    assert_eq!(b.batch_number, "LOT-2026-001");
    assert!(!b.is_expired(NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()));
    assert!(b.is_expired(NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()));

    let empty_batch = ProductBatch::new(
        tenant_id,
        product_id,
        "   ".to_string(),
        Some(mfg),
        Some(exp),
    );
    assert!(empty_batch.is_err());

    let invalid_dates = ProductBatch::new(
        tenant_id,
        product_id,
        "LOT-INV".to_string(),
        Some(exp),
        Some(mfg),
    );
    assert!(invalid_dates.is_err());
}

#[test]
fn test_deserializacao_evento_fatura_emitida() {
    use kudiba_inventory::application::dto::InvoiceIssuedPayload;

    let json_data = r#"{
        "invoiceId": "a0000000-0000-0000-0000-000000000001",
        "tenantId": "b0000000-0000-0000-0000-000000000002",
        "documentNumber": "FT 2026/1",
        "documentType": "FT",
        "lines": [
            {
                "lineNumber": 1,
                "productCode": "P-FISICO",
                "description": "Cimento 50kg",
                "quantity": "5.0000",
                "unitPrice": "4500.0000"
            },
            {
                "lineNumber": 2,
                "productCode": "S-CONSULTORIA",
                "description": "Honorários de Auditoria",
                "quantity": 2,
                "unitPrice": 150000
            }
        ]
    }"#;

    let payload: Result<InvoiceIssuedPayload, _> = serde_json::from_str(json_data);
    assert!(payload.is_ok());
    let p = payload.unwrap();
    assert_eq!(p.document_number, "FT 2026/1");
    assert_eq!(p.document_type, "FT");
    assert_eq!(p.lines.len(), 2);
    assert_eq!(p.lines[0].quantity, dec!(5.0000));
    assert_eq!(p.lines[0].unit_price, Some(dec!(4500.0000)));
    assert_eq!(p.lines[1].quantity, dec!(2));
    assert_eq!(p.lines[1].unit_price, Some(dec!(150000)));
}

#[tokio::test]
async fn test_processamento_evento_ignora_guias_e_notas_de_credito() {
    use kudiba_inventory::application::commands::ProcessInvoiceIssuedCommand;
    use kudiba_inventory::application::dto::InvoiceIssuedPayload;
    use kudiba_inventory::infrastructure::persistence::{
        PostgresBatchRepository, PostgresProductRepository, PostgresStockRepository,
        PostgresWarehouseRepository,
    };
    use std::sync::Arc;

    struct DummyUowFactory;
    #[async_trait::async_trait]
    impl kudiba_inventory::domain::ports::unit_of_work::UnitOfWorkFactory for DummyUowFactory {
        async fn begin(
            &self,
        ) -> Result<
            Box<dyn kudiba_inventory::domain::ports::unit_of_work::UnitOfWork>,
            kudiba_inventory::domain::ports::db_session::RepositoryError,
        > {
            panic!("Não deve iniciar transação para documentos que não são de venda");
        }
    }

    let cmd = ProcessInvoiceIssuedCommand::new(
        Arc::new(DummyUowFactory),
        Arc::new(PostgresProductRepository::new()),
        Arc::new(PostgresWarehouseRepository::new()),
        Arc::new(PostgresStockRepository::new()),
        Arc::new(PostgresBatchRepository::new()),
        Arc::new(MockInventoryEventPublisher::default()),
    );

    let payload_gt = InvoiceIssuedPayload {
        invoice_id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        document_number: "GT 2026/1".to_string(),
        document_type: "GT".to_string(),
        lines: vec![],
    };

    let res_gt = cmd
        .execute(payload_gt.tenant_id, Uuid::nil(), payload_gt)
        .await
        .unwrap();
    assert!(!res_gt.processed);
    assert_eq!(res_gt.movements_recorded, 0);

    let payload_nc = InvoiceIssuedPayload {
        invoice_id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        document_number: "NC 2026/1".to_string(),
        document_type: "NC".to_string(),
        lines: vec![],
    };

    let res_nc = cmd
        .execute(payload_nc.tenant_id, Uuid::nil(), payload_nc)
        .await
        .unwrap();
    assert!(!res_nc.processed);
    assert_eq!(res_nc.movements_recorded, 0);
}

#[tokio::test]
async fn test_processamento_evento_fatura_com_produtos_fisicos_e_servicos() {
    use kudiba_inventory::application::commands::ProcessInvoiceIssuedCommand;
    use kudiba_inventory::application::dto::{InvoiceIssuedLine, InvoiceIssuedPayload};
    use kudiba_inventory::domain::entities::{
        Product, StockBalance, StockMovement, StockMovementType, Warehouse,
    };
    use kudiba_inventory::domain::ports::db_session::{DbSession, RepositoryError};
    use kudiba_inventory::domain::ports::unit_of_work::{UnitOfWork, UnitOfWorkFactory};
    use kudiba_inventory::domain::ports::{
        BatchRepository, ProductRepository, StockRepository, WarehouseRepository,
    };
    use kudiba_inventory::domain::value_objects::ProductType;
    use std::sync::{Arc, Mutex};

    struct MockUow;
    impl DbSession for MockUow {
        fn connection(&mut self) -> &mut sqlx::PgConnection {
            unreachable!()
        }
    }
    #[async_trait::async_trait]
    impl UnitOfWork for MockUow {
        async fn commit(&mut self) -> Result<(), RepositoryError> {
            Ok(())
        }
        async fn rollback(&mut self) -> Result<(), RepositoryError> {
            Ok(())
        }
    }

    struct MockUowFactory;
    #[async_trait::async_trait]
    impl UnitOfWorkFactory for MockUowFactory {
        async fn begin(&self) -> Result<Box<dyn UnitOfWork>, RepositoryError> {
            Ok(Box::new(MockUow))
        }
    }

    let tenant_id = Uuid::new_v4();
    let warehouse_id = Uuid::new_v4();
    let branch_id = Uuid::new_v4();

    let physical_product = Product::new(
        tenant_id,
        "PROD-01".into(),
        None,
        "Cimento 50kg".into(),
        None,
        ProductType::Goods,
        Some(true),
        false,
        "SC".into(),
        dec!(5000),
        dec!(3000),
        dec!(14),
        None,
        None,
        None,
    )
    .unwrap();

    let service_product = Product::new(
        tenant_id,
        "SERV-01".into(),
        None,
        "Transporte e Descarga".into(),
        None,
        ProductType::Service,
        Some(false),
        false,
        "UN".into(),
        dec!(10000),
        dec!(0),
        dec!(14),
        None,
        None,
        None,
    )
    .unwrap();

    struct MockProductRepo {
        p1: Product,
        p2: Product,
    }
    #[async_trait::async_trait]
    impl ProductRepository for MockProductRepo {
        async fn find_by_id(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Option<Product>, RepositoryError> {
            unreachable!()
        }
        async fn find_by_code(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            code: &str,
        ) -> Result<Option<Product>, RepositoryError> {
            if code == self.p1.code {
                Ok(Some(self.p1.clone()))
            } else if code == self.p2.code {
                Ok(Some(self.p2.clone()))
            } else {
                Ok(None)
            }
        }
        async fn lock_by_id(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Option<Product>, RepositoryError> {
            unreachable!()
        }
        async fn save(&self, _: &mut dyn DbSession, _: &Product) -> Result<(), RepositoryError> {
            unreachable!()
        }
        async fn update(&self, _: &mut dyn DbSession, _: &Product) -> Result<(), RepositoryError> {
            unreachable!()
        }
        async fn update_prices_and_cmp(
            &self,
            _: &mut dyn DbSession,
            _: &Product,
        ) -> Result<(), RepositoryError> {
            unreachable!()
        }
        async fn list(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: i64,
            _: i64,
        ) -> Result<Vec<Product>, RepositoryError> {
            unreachable!()
        }
    }

    struct MockWarehouseRepo {
        warehouse: Warehouse,
    }
    #[async_trait::async_trait]
    impl WarehouseRepository for MockWarehouseRepo {
        async fn find_by_id(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Option<Warehouse>, RepositoryError> {
            unreachable!()
        }
        async fn find_by_code(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: &str,
        ) -> Result<Option<Warehouse>, RepositoryError> {
            unreachable!()
        }
        async fn save(&self, _: &mut dyn DbSession, _: &Warehouse) -> Result<(), RepositoryError> {
            unreachable!()
        }
        async fn update(
            &self,
            _: &mut dyn DbSession,
            _: &Warehouse,
        ) -> Result<(), RepositoryError> {
            unreachable!()
        }
        async fn list_by_branch(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Vec<Warehouse>, RepositoryError> {
            unreachable!()
        }
        async fn list_all(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
        ) -> Result<Vec<Warehouse>, RepositoryError> {
            Ok(vec![self.warehouse.clone()])
        }
    }

    let default_warehouse = Warehouse {
        id: warehouse_id,
        tenant_id,
        branch_id,
        code: "ARM-01".into(),
        name: "Armazém Central".into(),
        is_default: true,
        address_detail: None,
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    struct MockStockRepo {
        balance: Mutex<StockBalance>,
        saved_balance: Mutex<Option<StockBalance>>,
        movements: Mutex<Vec<StockMovement>>,
    }
    #[async_trait::async_trait]
    impl StockRepository for MockStockRepo {
        async fn find_balance(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
            _: Uuid,
        ) -> Result<Option<StockBalance>, RepositoryError> {
            unreachable!()
        }
        async fn find_balance_for_update(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
            _: Uuid,
        ) -> Result<Option<StockBalance>, RepositoryError> {
            let b = self.balance.lock().unwrap().clone();
            Ok(Some(b))
        }
        async fn total_on_hand(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<rust_decimal::Decimal, RepositoryError> {
            unreachable!()
        }
        async fn save_balance(
            &self,
            _: &mut dyn DbSession,
            balance: &StockBalance,
        ) -> Result<(), RepositoryError> {
            *self.saved_balance.lock().unwrap() = Some(balance.clone());
            Ok(())
        }
        async fn record_movement(
            &self,
            _: &mut dyn DbSession,
            movement: &StockMovement,
        ) -> Result<(), RepositoryError> {
            self.movements.lock().unwrap().push(movement.clone());
            Ok(())
        }
        async fn list_balances_by_product(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Vec<StockBalance>, RepositoryError> {
            unreachable!()
        }
        async fn list_movements(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Option<Uuid>,
            _: Option<Uuid>,
            _: i64,
        ) -> Result<Vec<StockMovement>, RepositoryError> {
            unreachable!()
        }
    }

    struct MockBatchRepo;
    #[async_trait::async_trait]
    impl BatchRepository for MockBatchRepo {
        async fn find_by_id(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Option<kudiba_inventory::domain::entities::ProductBatch>, RepositoryError>
        {
            unreachable!()
        }
        async fn find_by_number(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
            _: &str,
        ) -> Result<Option<kudiba_inventory::domain::entities::ProductBatch>, RepositoryError>
        {
            unreachable!()
        }
        async fn save(
            &self,
            _: &mut dyn DbSession,
            _: &kudiba_inventory::domain::entities::ProductBatch,
        ) -> Result<(), RepositoryError> {
            unreachable!()
        }
        async fn list_by_product(
            &self,
            _: &mut dyn DbSession,
            _: Uuid,
            _: Uuid,
        ) -> Result<Vec<kudiba_inventory::domain::entities::ProductBatch>, RepositoryError>
        {
            Ok(vec![])
        }
    }

    let initial_balance = StockBalance {
        id: Uuid::new_v4(),
        tenant_id,
        warehouse_id,
        product_id: physical_product.id,
        quantity_on_hand: dec!(10),
        quantity_reserved: dec!(0),
        reorder_point: dec!(2),
        updated_at: chrono::Utc::now(),
    };

    let stock_repo = Arc::new(MockStockRepo {
        balance: Mutex::new(initial_balance),
        saved_balance: Mutex::new(None),
        movements: Mutex::new(vec![]),
    });

    let event_pub = Arc::new(MockInventoryEventPublisher::default());
    let cmd = ProcessInvoiceIssuedCommand::new(
        Arc::new(MockUowFactory),
        Arc::new(MockProductRepo {
            p1: physical_product.clone(),
            p2: service_product.clone(),
        }),
        Arc::new(MockWarehouseRepo {
            warehouse: default_warehouse,
        }),
        stock_repo.clone(),
        Arc::new(MockBatchRepo),
        event_pub.clone(),
    );

    let event = InvoiceIssuedPayload {
        invoice_id: Uuid::new_v4(),
        tenant_id,
        document_number: "FT 2026/100".into(),
        document_type: "FT".into(),
        lines: vec![
            InvoiceIssuedLine {
                line_number: 1,
                product_code: "PROD-01".into(),
                description: "Cimento 50kg".into(),
                quantity: dec!(3),
                unit_price: Some(dec!(5000)),
                batch_id: None,
                batch_number: None,
            },
            InvoiceIssuedLine {
                line_number: 2,
                product_code: "SERV-01".into(),
                description: "Transporte e Descarga".into(),
                quantity: dec!(1),
                unit_price: Some(dec!(10000)),
                batch_id: None,
                batch_number: None,
            },
        ],
    };

    let outcome = cmd.execute(tenant_id, Uuid::nil(), event).await.unwrap();
    assert!(outcome.processed);
    assert_eq!(outcome.movements_recorded, 1);
    assert_eq!(outcome.items_skipped_intangible, 1);

    // Verifica que o evento de saída ao CMP (3 * 3000 = 9.000 Kz) foi publicado para a contabilidade
    let published_events = event_pub.published.lock().unwrap().clone();
    assert_eq!(published_events.len(), 1);
    assert_eq!(published_events[0].0, tenant_id);
    assert_eq!(published_events[0].1, "FT 2026/100");
    assert_eq!(published_events[0].3, dec!(9000));

    // Verifica que o saldo foi reduzido de 10 para 7 (10 - 3)
    let saved = stock_repo.saved_balance.lock().unwrap().clone().unwrap();
    assert_eq!(saved.quantity_on_hand, dec!(7));

    // Verifica que o movimento de venda foi registado com os metadados fiscais
    let movs = stock_repo.movements.lock().unwrap().clone();
    assert_eq!(movs.len(), 1);
    assert_eq!(movs[0].product_id, physical_product.id);
    assert_eq!(movs[0].quantity, dec!(3));
    assert_eq!(movs[0].movement_type, StockMovementType::OutSale);
    assert_eq!(movs[0].document_ref, Some("FT 2026/100".into()));
}

#[tokio::test]
async fn test_atualizacao_de_detalhes_de_produto_entidade_e_armazem() {
    use kudiba_inventory::domain::entities::{CommercialEntity, EntityKind, Warehouse};

    let tenant_id = Uuid::new_v4();
    let branch_id = Uuid::new_v4();

    // 1. Atualização de Produto
    let mut prod = Product::new(
        tenant_id,
        "PROD-01".into(),
        None,
        "Produto Teste".into(),
        None,
        ProductType::Goods,
        Some(true),
        false,
        "UN".into(),
        dec!(100),
        dec!(50),
        dec!(14),
        None,
        None,
        None,
    )
    .unwrap();

    prod.update_details(
        Some("Produto Teste Atualizado".into()),
        Some("Nova descrição".into()),
        Some("5601234567890".into()),
        Some("KG".into()),
        Some(dec!(120)),
        Some(dec!(60)),
        Some(dec!(0)),
        Some("M10".into()),
        Some("Isento nos termos da lei".into()),
        Some(false),
        Some(true),
    )
    .unwrap();

    assert_eq!(prod.name, "Produto Teste Atualizado");
    assert_eq!(prod.sale_price, dec!(120));
    assert_eq!(prod.cost_price, dec!(60));
    assert_eq!(prod.tax_percentage, dec!(0));
    assert_eq!(prod.tax_code, "ISE");
    assert_eq!(prod.exemption_reason_code.as_deref(), Some("M10"));
    assert_eq!(prod.barcode.as_deref(), Some("5601234567890"));
    assert_eq!(prod.unit_of_measure, "KG");

    // 2. Atualização de Entidade
    let mut entity = CommercialEntity::new(
        tenant_id,
        EntityKind::Customer,
        kudiba_inventory::domain::value_objects::TaxId::new(
            "5412345678",
            kudiba_inventory::domain::value_objects::TaxIdKind::LegalEntity,
        )
        .unwrap(),
        "Empresa Alpha Lda".into(),
        None,
        Some("contacto@alpha.ao".into()),
        Some("+244923111222".into()),
        false,
        Some("AO".into()),
        Some("Luanda".into()),
        Some("Luanda".into()),
        Some("Rua Principal 10".into()),
        None,
    )
    .unwrap();

    entity
        .update(
            Some("Empresa Alpha Actualizada Lda".into()),
            Some("Alpha Group".into()),
            Some("financeiro@alpha.ao".into()),
            Some("+244923999888".into()),
            Some(true),
            Some("AO".into()),
            Some("Benguela".into()),
            Some("Lobito".into()),
            Some("Avenida Marginal 45".into()),
            Some("AO06004000001234567890123".into()),
            Some(true),
        )
        .unwrap();

    assert_eq!(entity.name, "Empresa Alpha Actualizada Lda");
    assert_eq!(entity.trade_name.as_deref(), Some("Alpha Group"));
    assert_eq!(entity.email.as_deref(), Some("financeiro@alpha.ao"));
    assert!(entity.is_withholding_agent);
    assert_eq!(entity.iban.as_deref(), Some("AO06004000001234567890123"));

    // 3. Atualização de Armazém
    let mut warehouse = Warehouse::new(
        tenant_id,
        branch_id,
        "ARM-01".into(),
        "Armazém Central".into(),
        false,
        None,
    )
    .unwrap();

    warehouse
        .update(
            Some("Armazém Geral Luanda Sul".into()),
            Some(true),
            Some("Viana, Km 14".into()),
            Some(true),
        )
        .unwrap();

    assert_eq!(warehouse.name, "Armazém Geral Luanda Sul");
    assert!(warehouse.is_default);
    assert_eq!(warehouse.address_detail.as_deref(), Some("Viana, Km 14"));
}

#[test]
fn test_invoicing_outbox_event_payload_compat() {
    let tenant_id = Uuid::new_v4();
    let invoice_id = Uuid::new_v4();

    let invoicing_outbox_json = serde_json::json!({
        "event_id": Uuid::new_v4(),
        "tenant_id": tenant_id,
        "invoice_id": invoice_id,
        "event_type": "fiscal.document.issued",
        "payload": {
            "invoiceId": invoice_id,
            "tenantId": tenant_id,
            "documentNumber": "FT 2026A/1",
            "documentType": "FT",
            "lines": [
                {
                    "lineNumber": 1,
                    "productCode": "ART-001",
                    "description": "Artigo Teste",
                    "quantity": "5",
                    "unitPrice": "1500.00",
                    "discountAmount": "0.00",
                    "taxRate": "14.00",
                    "lineTotal": "7500.00"
                }
            ]
        },
        "created_at": chrono::Utc::now()
    });

    let bytes = serde_json::to_vec(&invoicing_outbox_json).unwrap();
    let parsed =
        kudiba_inventory::infrastructure::events::InvoiceEventConsumer::parse_invoice_event(&bytes)
            .unwrap();

    assert_eq!(parsed.invoice_id, invoice_id);
    assert_eq!(parsed.tenant_id, tenant_id);
    assert_eq!(parsed.document_number, "FT 2026A/1");
    assert_eq!(parsed.lines.len(), 1);
    assert_eq!(parsed.lines[0].product_code, "ART-001");
    assert_eq!(parsed.lines[0].quantity, rust_decimal::Decimal::from(5));
}
