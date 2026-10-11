use std::ops::DerefMut;

use async_trait::async_trait;
use sqlx::{PgPool, Postgres};

use crate::domain::ports::db_session::{DbSession, DbSessionFactory, RepositoryError};
use crate::domain::ports::unit_of_work::{UnitOfWork, UnitOfWorkFactory};

pub struct PgSession {
    connection: sqlx::pool::PoolConnection<Postgres>,
}

#[async_trait]
impl DbSession for PgSession {
    fn connection(&mut self) -> &mut sqlx::PgConnection {
        &mut self.connection
    }
}

pub struct PgSessionFactory {
    pool: PgPool,
}

impl PgSessionFactory {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl DbSessionFactory for PgSessionFactory {
    async fn open(&self) -> Result<Box<dyn DbSession>, RepositoryError> {
        let connection = self.pool.acquire().await?;
        Ok(Box::new(PgSession { connection }))
    }
}

pub struct PgUnitOfWork {
    transaction: Option<sqlx::Transaction<'static, sqlx::Postgres>>,
}

#[async_trait]
impl DbSession for PgUnitOfWork {
    fn connection(&mut self) -> &mut sqlx::PgConnection {
        self.transaction
            .as_mut()
            .expect("transação já confirmada ou revertida")
            .deref_mut()
    }
}

#[async_trait]
impl UnitOfWork for PgUnitOfWork {
    async fn commit(&mut self) -> Result<(), RepositoryError> {
        match self.transaction.take() {
            Some(transaction) => {
                transaction.commit().await?;
                Ok(())
            }
            None => Err(RepositoryError::Database(
                "Não existe transação ativa para confirmar.".to_string(),
            )),
        }
    }

    async fn rollback(&mut self) -> Result<(), RepositoryError> {
        match self.transaction.take() {
            Some(transaction) => {
                transaction.rollback().await?;
                Ok(())
            }
            None => Err(RepositoryError::Database(
                "Não existe transação ativa para reverter.".to_string(),
            )),
        }
    }
}

pub struct PgUnitOfWorkFactory {
    pool: PgPool,
}

impl PgUnitOfWorkFactory {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UnitOfWorkFactory for PgUnitOfWorkFactory {
    async fn begin(&self) -> Result<Box<dyn UnitOfWork>, RepositoryError> {
        let transaction = self.pool.begin().await?;
        Ok(Box::new(PgUnitOfWork {
            transaction: Some(transaction),
        }))
    }
}
