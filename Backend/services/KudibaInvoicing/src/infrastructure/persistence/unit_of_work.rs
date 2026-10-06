use std::ops::DerefMut;

use async_trait::async_trait;
use sqlx::{PgPool, Postgres, Transaction};

use crate::domain::ports::db_session::{DbSession, DbSessionFactory, RepositoryError};
use crate::domain::ports::unit_of_work::{UnitOfWork, UnitOfWorkFactory};

/// Sessão de leitura em auto-commit (QUERY STACK do CQRS)
pub struct PgSession {
    connection: sqlx::pool::PoolConnection<Postgres>,
}

#[async_trait]
impl DbSession for PgSession {
    fn connection(&mut self) -> &mut sqlx::PgConnection {
        &mut self.connection
    }
}

/// Fábrica de sessões de leitura apoiada no pool de ligações
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

/// Unidade de Trabalho PostgreSQL: uma transação ACID por comando de escrita.
///
/// A transação é consumida no commit/rollback; qualquer comando que falhe deve
/// revertê-la para libertar imediatamente o lock pessimista da série fiscal.
pub struct PgUnitOfWork {
    transaction: Option<Transaction<'static, Postgres>>,
}

#[async_trait]
impl DbSession for PgUnitOfWork {
    fn connection(&mut self) -> &mut sqlx::PgConnection {
        self.transaction
            .as_mut()
            .expect("transacção fiscal já concluída")
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
                "Não existe transação activa para confirmar.".to_string(),
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
                "Não existe transação activa para reverter.".to_string(),
            )),
        }
    }
}

/// Fábrica de Unidades de Trabalho (abertura de transação em `READ COMMITTED`)
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
