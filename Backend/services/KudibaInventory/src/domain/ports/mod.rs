pub mod db_session;
pub mod event_publisher;
pub mod unit_of_work;

pub use event_publisher::InventoryEventPublisher;

use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::{
    CommercialEntity, Product, ProductBatch, StockBalance, StockMovement, Warehouse,
};
use crate::domain::ports::db_session::{DbSession, RepositoryError};

#[async_trait]
pub trait ProductRepository: Send + Sync {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Product>, RepositoryError>;
    async fn find_by_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Product>, RepositoryError>;
    async fn lock_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Product>, RepositoryError>;
    async fn save(
        &self,
        session: &mut dyn DbSession,
        product: &Product,
    ) -> Result<(), RepositoryError>;
    async fn update(
        &self,
        session: &mut dyn DbSession,
        product: &Product,
    ) -> Result<(), RepositoryError>;
    async fn update_prices_and_cmp(
        &self,
        session: &mut dyn DbSession,
        product: &Product,
    ) -> Result<(), RepositoryError>;
    async fn list(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Product>, RepositoryError>;
}

#[async_trait]
pub trait EntityRepository: Send + Sync {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CommercialEntity>, RepositoryError>;
    async fn find_by_tax_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        tax_id: &str,
    ) -> Result<Option<CommercialEntity>, RepositoryError>;
    async fn save(
        &self,
        session: &mut dyn DbSession,
        entity: &CommercialEntity,
    ) -> Result<(), RepositoryError>;
    async fn update(
        &self,
        session: &mut dyn DbSession,
        entity: &CommercialEntity,
    ) -> Result<(), RepositoryError>;
    async fn list(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<CommercialEntity>, RepositoryError>;
}

#[async_trait]
pub trait WarehouseRepository: Send + Sync {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Warehouse>, RepositoryError>;
    async fn find_by_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Warehouse>, RepositoryError>;
    async fn save(
        &self,
        session: &mut dyn DbSession,
        warehouse: &Warehouse,
    ) -> Result<(), RepositoryError>;
    async fn update(
        &self,
        session: &mut dyn DbSession,
        warehouse: &Warehouse,
    ) -> Result<(), RepositoryError>;
    async fn list_by_branch(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        branch_id: Uuid,
    ) -> Result<Vec<Warehouse>, RepositoryError>;
    async fn list_all(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
    ) -> Result<Vec<Warehouse>, RepositoryError>;
}

#[async_trait]
pub trait StockRepository: Send + Sync {
    async fn find_balance(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
    ) -> Result<Option<StockBalance>, RepositoryError>;

    async fn find_balance_for_update(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
    ) -> Result<Option<StockBalance>, RepositoryError>;

    async fn total_on_hand(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<rust_decimal::Decimal, RepositoryError>;

    async fn save_balance(
        &self,
        session: &mut dyn DbSession,
        balance: &StockBalance,
    ) -> Result<(), RepositoryError>;

    async fn record_movement(
        &self,
        session: &mut dyn DbSession,
        movement: &StockMovement,
    ) -> Result<(), RepositoryError>;

    async fn list_balances_by_product(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<Vec<StockBalance>, RepositoryError>;

    async fn list_movements(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Option<Uuid>,
        warehouse_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<StockMovement>, RepositoryError>;
}

#[async_trait]
pub trait BatchRepository: Send + Sync {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<ProductBatch>, RepositoryError>;

    async fn find_by_number(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
        batch_number: &str,
    ) -> Result<Option<ProductBatch>, RepositoryError>;

    async fn save(
        &self,
        session: &mut dyn DbSession,
        batch: &ProductBatch,
    ) -> Result<(), RepositoryError>;

    async fn list_by_product(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<Vec<ProductBatch>, RepositoryError>;
}
