use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::CashSession;
use crate::domain::error::DomainError;
use crate::domain::ports::CashSessionRepository;
use crate::domain::value_objects::SessionStatus;
use crate::infrastructure::persistence::models::CashSessionRow;

pub struct PostgresCashSessionRepository {
    pool: PgPool,
}

impl PostgresCashSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CashSessionRepository for PostgresCashSessionRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashSession>, DomainError> {
        let row = sqlx::query_as::<_, CashSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, pos_session_id, operator_user_id, opened_at,
                   closed_at, opening_balance, closing_balance_counted, closing_balance_system,
                   discrepancy, status, notes, created_at, updated_at
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn find_open_session_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
    ) -> Result<Option<CashSession>, DomainError> {
        let row = sqlx::query_as::<_, CashSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, pos_session_id, operator_user_id, opened_at,
                   closed_at, opening_balance, closing_balance_counted, closing_balance_system,
                   discrepancy, status, notes, created_at, updated_at
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND register_id = $2 AND status = $3
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(register_id)
        .bind(SessionStatus::Open)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn list_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
        limit: i64,
    ) -> Result<Vec<CashSession>, DomainError> {
        let rows = sqlx::query_as::<_, CashSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, pos_session_id, operator_user_id, opened_at,
                   closed_at, opening_balance, closing_balance_counted, closing_balance_system,
                   discrepancy, status, notes, created_at, updated_at
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND register_id = $2
            ORDER BY opened_at DESC
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(register_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn count_open_by_pos_session(
        &self,
        tenant_id: Uuid,
        pos_session_id: Uuid,
    ) -> Result<i64, DomainError> {
        let row = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND pos_session_id = $2 AND status = $3
            "#,
        )
        .bind(tenant_id)
        .bind(pos_session_id)
        .bind(SessionStatus::Open)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row)
    }

    async fn save(&self, session: &CashSession) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.cash_sessions
                (id, tenant_id, register_id, pos_session_id, operator_user_id, opened_at, closed_at,
                 opening_balance, closing_balance_counted, closing_balance_system,
                 discrepancy, status, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            "#,
        )
        .bind(session.id)
        .bind(session.tenant_id)
        .bind(session.register_id)
        .bind(session.pos_session_id)
        .bind(&session.operator_user_id)
        .bind(session.opened_at)
        .bind(session.closed_at)
        .bind(session.opening_balance)
        .bind(session.closing_balance_counted)
        .bind(session.closing_balance_system)
        .bind(session.discrepancy)
        .bind(session.status)
        .bind(&session.notes)
        .bind(session.created_at)
        .bind(session.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let audit_details = serde_json::json!({
            "session_id": session.id.to_string(),
            "register_id": session.register_id.to_string(),
            "operator_user_id": session.operator_user_id,
            "opening_balance": session.opening_balance.to_string(),
            "notes": session.notes
        });

        let _ = sqlx::query(
            r#"
            INSERT INTO kudiba_audit.system_audit_trail
                (tenant_id, module, action, entity_type, entity_id, document_reference, actor_user_id, actor_name, details, created_at)
            VALUES ($1, 'TESOURARIA', 'ABERTURA_SESSAO_CAIXA', 'SESSAO_CAIXA', $2, $3, $4, $4, $5, NOW())
            "#
        )
        .bind(session.tenant_id)
        .bind(session.id.to_string())
        .bind(format!("CX-SESSION-{}", &session.id.to_string()[..8]))
        .bind(&session.operator_user_id)
        .bind(audit_details)
        .execute(&self.pool)
        .await;

        tracing::info!(
            target: "audit::treasury",
            session_id = %session.id,
            register_id = %session.register_id,
            operator = %session.operator_user_id,
            "[AUDIT_TREASURY] Sessão de caixa aberta com sucesso"
        );

        Ok(())
    }

    async fn update(&self, session: &CashSession) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE kudiba_treasury.cash_sessions
            SET closed_at = $1, closing_balance_counted = $2, closing_balance_system = $3,
                discrepancy = $4, status = $5, notes = $6, updated_at = $7
            WHERE tenant_id = $8 AND id = $9
            "#,
        )
        .bind(session.closed_at)
        .bind(session.closing_balance_counted)
        .bind(session.closing_balance_system)
        .bind(session.discrepancy)
        .bind(session.status)
        .bind(&session.notes)
        .bind(session.updated_at)
        .bind(session.tenant_id)
        .bind(session.id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let audit_details = serde_json::json!({
            "session_id": session.id.to_string(),
            "register_id": session.register_id.to_string(),
            "operator_user_id": session.operator_user_id,
            "closing_balance_counted": session.closing_balance_counted.map(|v| v.to_string()),
            "closing_balance_system": session.closing_balance_system.map(|v| v.to_string()),
            "discrepancy": session.discrepancy.map(|v| v.to_string()),
            "status": format!("{:?}", session.status),
            "notes": session.notes
        });

        let _ = sqlx::query(
            r#"
            INSERT INTO kudiba_audit.system_audit_trail
                (tenant_id, module, action, entity_type, entity_id, document_reference, actor_user_id, actor_name, details, created_at)
            VALUES ($1, 'TESOURARIA', 'FECHO_SESSAO_CAIXA', 'SESSAO_CAIXA', $2, $3, $4, $4, $5, NOW())
            "#
        )
        .bind(session.tenant_id)
        .bind(session.id.to_string())
        .bind(format!("CX-SESSION-{}", &session.id.to_string()[..8]))
        .bind(&session.operator_user_id)
        .bind(audit_details)
        .execute(&self.pool)
        .await;

        tracing::info!(
            target: "audit::treasury",
            session_id = %session.id,
            register_id = %session.register_id,
            discrepancy = ?session.discrepancy,
            "[AUDIT_TREASURY] Sessão de caixa encerrada com sucesso"
        );

        Ok(())
    }
}
