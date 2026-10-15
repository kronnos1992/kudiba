use sqlx::PgPool;
use std::sync::Arc;

use crate::application::commands::{
    AdjustStockCommand, CreateBatchCommand, CreateProductCommand, CreateWarehouseCommand,
    DispatchSaleCommand, ProcessInvoiceIssuedCommand, ReceivePurchaseCommand,
    RegisterEntityCommand, TransferStockCommand, UpdateEntityCommand, UpdateProductCommand,
    UpdateProductPriceCommand, UpdateWarehouseCommand,
};
use crate::application::queries::{
    GetBatchQuery, GetEntityQuery, GetProductQuery, GetStockQuery, GetWarehouseQuery,
};
use crate::config::Config;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::event_publisher::InventoryEventPublisher;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::infrastructure::events::{InvoiceEventConsumer, MultiChannelInventoryEventPublisher};
use crate::infrastructure::persistence::{
    PgSessionFactory, PgUnitOfWorkFactory, PostgresBatchRepository, PostgresEntityRepository,
    PostgresProductRepository, PostgresStockRepository, PostgresWarehouseRepository,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db_pool: PgPool,
    pub create_product_cmd: Arc<CreateProductCommand>,
    pub update_product_cmd: Arc<UpdateProductCommand>,
    pub register_entity_cmd: Arc<RegisterEntityCommand>,
    pub update_entity_cmd: Arc<UpdateEntityCommand>,
    pub create_warehouse_cmd: Arc<CreateWarehouseCommand>,
    pub update_warehouse_cmd: Arc<UpdateWarehouseCommand>,
    pub receive_purchase_cmd: Arc<ReceivePurchaseCommand>,
    pub transfer_stock_cmd: Arc<TransferStockCommand>,
    pub dispatch_sale_cmd: Arc<DispatchSaleCommand>,
    pub adjust_stock_cmd: Arc<AdjustStockCommand>,
    pub create_batch_cmd: Arc<CreateBatchCommand>,
    pub update_product_price_cmd: Arc<UpdateProductPriceCommand>,
    pub process_invoice_issued_cmd: Arc<ProcessInvoiceIssuedCommand>,
    pub event_publisher: Arc<dyn InventoryEventPublisher>,
    pub event_consumer: Arc<InvoiceEventConsumer>,
    pub get_product_query: Arc<GetProductQuery>,
    pub get_entity_query: Arc<GetEntityQuery>,
    pub get_warehouse_query: Arc<GetWarehouseQuery>,
    pub get_stock_query: Arc<GetStockQuery>,
    pub get_batch_query: Arc<GetBatchQuery>,
}

impl AppState {
    pub fn new(config: Config, pool: PgPool) -> Self {
        let session_factory: Arc<dyn DbSessionFactory> =
            Arc::new(PgSessionFactory::new(pool.clone()));
        let uow_factory: Arc<dyn UnitOfWorkFactory> =
            Arc::new(PgUnitOfWorkFactory::new(pool.clone()));

        let product_repo = Arc::new(PostgresProductRepository::new());
        let entity_repo = Arc::new(PostgresEntityRepository::new());
        let warehouse_repo = Arc::new(PostgresWarehouseRepository::new());
        let stock_repo = Arc::new(PostgresStockRepository::new());
        let batch_repo = Arc::new(PostgresBatchRepository::new());

        let create_product_cmd = Arc::new(CreateProductCommand::new(
            session_factory.clone(),
            product_repo.clone(),
        ));
        let register_entity_cmd = Arc::new(RegisterEntityCommand::new(
            session_factory.clone(),
            entity_repo.clone(),
        ));
        let create_warehouse_cmd = Arc::new(CreateWarehouseCommand::new(
            session_factory.clone(),
            warehouse_repo.clone(),
        ));
        let receive_purchase_cmd = Arc::new(ReceivePurchaseCommand::new(
            uow_factory.clone(),
            product_repo.clone(),
            warehouse_repo.clone(),
            stock_repo.clone(),
            batch_repo.clone(),
        ));
        let transfer_stock_cmd = Arc::new(TransferStockCommand::new(
            uow_factory.clone(),
            product_repo.clone(),
            warehouse_repo.clone(),
            stock_repo.clone(),
            batch_repo.clone(),
        ));

        let dispatch_sale_cmd = Arc::new(DispatchSaleCommand::new(
            uow_factory.clone(),
            product_repo.clone(),
            warehouse_repo.clone(),
            stock_repo.clone(),
            batch_repo.clone(),
        ));

        let adjust_stock_cmd = Arc::new(AdjustStockCommand::new(
            uow_factory.clone(),
            product_repo.clone(),
            warehouse_repo.clone(),
            stock_repo.clone(),
            batch_repo.clone(),
        ));

        let create_batch_cmd = Arc::new(CreateBatchCommand::new(
            session_factory.clone(),
            product_repo.clone(),
            batch_repo.clone(),
        ));

        let update_product_price_cmd = Arc::new(UpdateProductPriceCommand::new(
            uow_factory.clone(),
            product_repo.clone(),
        ));

        let update_product_cmd = Arc::new(UpdateProductCommand::new(
            uow_factory.clone(),
            product_repo.clone(),
        ));

        let update_entity_cmd = Arc::new(UpdateEntityCommand::new(
            uow_factory.clone(),
            entity_repo.clone(),
        ));

        let update_warehouse_cmd = Arc::new(UpdateWarehouseCommand::new(
            uow_factory.clone(),
            warehouse_repo.clone(),
        ));

        let event_publisher: Arc<dyn InventoryEventPublisher> = Arc::new(
            MultiChannelInventoryEventPublisher::new(config.rabbitmq_url.clone()),
        );

        let process_invoice_issued_cmd = Arc::new(ProcessInvoiceIssuedCommand::new(
            uow_factory,
            product_repo.clone(),
            warehouse_repo.clone(),
            stock_repo.clone(),
            batch_repo.clone(),
            event_publisher.clone(),
        ));

        let event_consumer = Arc::new(InvoiceEventConsumer::new(
            process_invoice_issued_cmd.clone(),
            config.rabbitmq_url.clone(),
        ));

        let get_product_query =
            Arc::new(GetProductQuery::new(session_factory.clone(), product_repo));
        let get_entity_query = Arc::new(GetEntityQuery::new(session_factory.clone(), entity_repo));
        let get_warehouse_query = Arc::new(GetWarehouseQuery::new(
            session_factory.clone(),
            warehouse_repo,
        ));
        let get_stock_query = Arc::new(GetStockQuery::new(session_factory.clone(), stock_repo));
        let get_batch_query = Arc::new(GetBatchQuery::new(session_factory, batch_repo));

        Self {
            config: Arc::new(config),
            db_pool: pool,
            create_product_cmd,
            update_product_cmd,
            register_entity_cmd,
            update_entity_cmd,
            create_warehouse_cmd,
            update_warehouse_cmd,
            receive_purchase_cmd,
            transfer_stock_cmd,
            dispatch_sale_cmd,
            adjust_stock_cmd,
            create_batch_cmd,
            update_product_price_cmd,
            process_invoice_issued_cmd,
            event_publisher,
            event_consumer,
            get_product_query,
            get_entity_query,
            get_warehouse_query,
            get_stock_query,
            get_batch_query,
        }
    }
}
