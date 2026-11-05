use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::application::dto::{
    AdjustStockRequest, CreateBatchRequest, CreateProductRequest, CreateWarehouseRequest,
    DispatchSaleRequest, InvoiceIssuedPayload, ReceivePurchaseRequest, RegisterEntityRequest,
    TransferStockRequest, UpdateEntityRequest, UpdateProductPriceRequest, UpdateProductRequest,
    UpdateWarehouseRequest,
};
use crate::domain::error::InventoryError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ProblemDetail {
    pub r#type: String,
    pub title: String,
    pub status: u16,
    pub detail: String,
    pub error_code: String,
}

impl ProblemDetail {
    pub fn new(status: StatusCode, title: &str, detail: &str, error_code: &str) -> Self {
        Self {
            r#type: format!(
                "https://api.kudiba.ao/errors/{}",
                error_code.to_lowercase().replace('_', "-")
            ),
            title: title.to_string(),
            status: status.as_u16(),
            detail: detail.to_string(),
            error_code: error_code.to_string(),
        }
    }
}

fn map_domain_error(err: InventoryError) -> (StatusCode, Json<ProblemDetail>) {
    match err {
        InventoryError::InvalidTaxId(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetail::new(
                StatusCode::BAD_REQUEST,
                "Identificador Fiscal Inválido",
                &msg,
                "INVALID_TAX_ID",
            )),
        ),
        InventoryError::IntangibleCannotMoveStock(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Operação Inválida para Intangível",
                &msg,
                "INTANGIBLE_CANNOT_MOVE_STOCK",
            )),
        ),
        InventoryError::IntangibleCannotHaveCargoDocument(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Guia Inválida para Intangível",
                &msg,
                "INTANGIBLE_CARGO_NOT_ALLOWED",
            )),
        ),
        InventoryError::InsufficientStock {
            available,
            requested,
            ..
        } => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Stock Insuficiente",
                &format!("Saldo disponível: {}, Solicitado: {}", available, requested),
                "INSUFFICIENT_STOCK",
            )),
        ),
        InventoryError::ProductNotFound(_) | InventoryError::ProductCodeNotFound(_) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetail::new(
                StatusCode::NOT_FOUND,
                "Artigo Não Encontrado",
                "O artigo solicitado não existe",
                "PRODUCT_NOT_FOUND",
            )),
        ),
        InventoryError::DuplicateProductCode(code) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Código em Duplicado",
                &format!("O código '{}' já existe", code),
                "DUPLICATE_PRODUCT_CODE",
            )),
        ),
        InventoryError::DuplicateTaxId(tax_id) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "NIF em Duplicado",
                &format!("O NIF '{}' já está cadastrado", tax_id),
                "DUPLICATE_TAX_ID",
            )),
        ),
        InventoryError::EntityNotFound(_) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetail::new(
                StatusCode::NOT_FOUND,
                "Entidade Não Encontrada",
                "Cliente ou fornecedor não encontrado",
                "ENTITY_NOT_FOUND",
            )),
        ),
        InventoryError::WarehouseNotFound(_) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetail::new(
                StatusCode::NOT_FOUND,
                "Armazém Não Encontrado",
                "O armazém solicitado não existe",
                "WAREHOUSE_NOT_FOUND",
            )),
        ),
        InventoryError::DuplicateWarehouseCode(code) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Armazém em Duplicado",
                &format!("Código '{}' já existe", code),
                "DUPLICATE_WAREHOUSE_CODE",
            )),
        ),
        InventoryError::BatchNotFound(_) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetail::new(
                StatusCode::NOT_FOUND,
                "Lote Não Encontrado",
                "O lote solicitado não existe",
                "BATCH_NOT_FOUND",
            )),
        ),
        InventoryError::DuplicateBatchNumber(batch) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Lote em Duplicado",
                &format!("O lote '{}' já existe para este artigo", batch),
                "DUPLICATE_BATCH_NUMBER",
            )),
        ),
        InventoryError::BatchExpired(batch) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Lote Expirado",
                &format!("O lote '{}' atingiu a data de validade", batch),
                "BATCH_EXPIRED",
            )),
        ),
        InventoryError::BatchRequired(name) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetail::new(
                StatusCode::BAD_REQUEST,
                "Lote Obrigatório",
                &format!("O artigo '{}' exige a indicação de lote", name),
                "BATCH_REQUIRED",
            )),
        ),
        InventoryError::BatchNotAllowed(name) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetail::new(
                StatusCode::BAD_REQUEST,
                "Lote Não Permitido",
                &format!("O artigo '{}' não possui controlo de lotes", name),
                "BATCH_NOT_ALLOWED",
            )),
        ),
        InventoryError::InvalidQuantity(msg)
        | InventoryError::InvalidPrice(msg)
        | InventoryError::ValidationError(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetail::new(
                StatusCode::BAD_REQUEST,
                "Dados Inválidos",
                &msg,
                "VALIDATION_ERROR",
            )),
        ),
        InventoryError::DatabaseError(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetail::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erro Interno",
                &err,
                "DATABASE_ERROR",
            )),
        ),
    }
}

fn extract_tenant_id(headers: &HeaderMap) -> Result<Uuid, (StatusCode, Json<ProblemDetail>)> {
    match headers
        .get("X-Resolved-Tenant-ID")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
    {
        Some(id) => Ok(id),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(ProblemDetail::new(
                StatusCode::UNAUTHORIZED,
                "Tenant Não Identificado",
                "O cabeçalho X-Resolved-Tenant-ID é obrigatório e deve ser um UUID válido.",
                "TENANT_HEADER_MISSING",
            )),
        )),
    }
}

fn extract_user_id(headers: &HeaderMap) -> Uuid {
    headers
        .get("X-Resolved-User-ID")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::nil)
}

fn extract_actor_info(headers: &HeaderMap) -> (String, String, Option<String>) {
    let user_id = headers
        .get("X-Resolved-User-ID")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "sistema".to_string());

    let user_name = headers
        .get("X-Resolved-User-Name")
        .or_else(|| headers.get("X-Resolved-Email"))
        .or_else(|| headers.get("X-Resolved-User-Email"))
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Gestor de Stock / Operador".to_string());

    let ip = headers
        .get("X-Forwarded-For")
        .or_else(|| headers.get("X-Real-IP"))
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    (user_id, user_name, ip)
}

fn ensure_audit_access(headers: &HeaderMap) -> Result<(), (StatusCode, Json<ProblemDetail>)> {
    let allowed = headers
        .get("X-Resolved-Roles")
        .and_then(|h| h.to_str().ok())
        .map(|raw| {
            raw.split(',')
                .map(|role| role.trim().to_uppercase())
                .any(|role| {
                    matches!(
                        role.as_str(),
                        "ADMIN"
                            | "ADMINISTRADOR"
                            | "SYSADMIN"
                            | "SUPER_ADMIN"
                            | "AUDITOR"
                            | "GESTOR"
                            | "GESTOR_STOCK"
                            | "CONTABILISTA"
                    )
                })
        })
        .unwrap_or(false);

    if allowed {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(ProblemDetail::new(
                StatusCode::FORBIDDEN,
                "Acesso Negado",
                "Apenas perfis de administração, auditoria ou gestão podem consultar a trilha de auditoria.",
                "AUDIT_ACCESS_DENIED",
            )),
        ))
    }
}

#[allow(clippy::too_many_arguments)]
async fn record_inventory_audit(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    action: &str,
    entity_type: &str,
    entity_id: Option<&str>,
    document_reference: Option<&str>,
    actor_user_id: Option<&str>,
    actor_name: Option<&str>,
    _ip_address: Option<&str>,
    details: serde_json::Value,
) {
    let res = sqlx::query(
        r#"
        INSERT INTO kudiba_audit.system_audit_trail
            (tenant_id, module, action, entity_type, entity_id, document_reference, actor_user_id, actor_name, details, created_at)
        VALUES ($1, 'INVENTARIO', $2, $3, $4, $5, $6, $7, $8, NOW())
        "#,
    )
    .bind(tenant_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(document_reference)
    .bind(actor_user_id.unwrap_or("sistema"))
    .bind(actor_name.unwrap_or("Sistema / Gestor de Stock"))
    .bind(details)
    .execute(pool)
    .await;

    if let Err(err) = res {
        tracing::warn!(target: "audit::inventory", action, error = %err, "Falha ao registar auditoria de inventário");
    }
}

#[derive(Debug, Deserialize)]
pub struct SystemAuditTrailQueryParams {
    pub module: Option<String>,
    pub action: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SystemAuditTrailEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub module: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub document_reference: Option<String>,
    pub actor_user_id: Option<String>,
    pub actor_name: Option<String>,
    pub ip_address: Option<String>,
    pub details: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct MovementsQuery {
    pub product_id: Option<Uuid>,
    pub warehouse_id: Option<Uuid>,
    pub limit: Option<i64>,
}

// ----------------------------------------------------------------------------
// Health Handlers
// ----------------------------------------------------------------------------

async fn health_handler() -> &'static str {
    "OK"
}

async fn ready_handler(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query("SELECT 1").execute(&state.db_pool).await {
        Ok(_) => (StatusCode::OK, "READY"),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE"),
    }
}

// ----------------------------------------------------------------------------
// Product Handlers
// ----------------------------------------------------------------------------

async fn create_product_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateProductRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let product = state
        .create_product_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "CRIAR_ARTIGO",
        "ARTIGO",
        Some(&product.id.to_string()),
        Some(&product.code),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "code": product.code,
            "name": product.name,
            "product_type": product.product_type,
            "sale_price": product.sale_price,
            "tax_percentage": product.tax_percentage,
            "unit_of_measure": product.unit_of_measure,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(product)))
}

async fn list_products_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(pagination): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let limit = pagination.limit.unwrap_or(50).clamp(1, 200);
    let offset = pagination.offset.unwrap_or(0).max(0);

    let products = state
        .get_product_query
        .list(tenant_id, limit, offset)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(products))
}

async fn get_product_by_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let product = state
        .get_product_query
        .get_by_id(tenant_id, id)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| map_domain_error(InventoryError::ProductNotFound(id)))?;

    Ok(Json(product))
}

async fn get_product_by_code_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let product = state
        .get_product_query
        .get_by_code(tenant_id, &code)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| map_domain_error(InventoryError::ProductNotFound(Uuid::nil())))?;

    Ok(Json(product))
}

async fn update_product_price_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProductPriceRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let product = state
        .update_product_price_cmd
        .execute(tenant_id, id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "ALTERAR_PRECO_VENDA",
        "ARTIGO",
        Some(&product.id.to_string()),
        Some(&product.code),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "code": product.code,
            "name": product.name,
            "sale_price": product.sale_price,
        }),
    )
    .await;

    Ok(Json(product))
}

async fn update_product_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProductRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let product = state
        .update_product_cmd
        .execute(tenant_id, id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "ATUALIZAR_ARTIGO",
        "ARTIGO",
        Some(&product.id.to_string()),
        Some(&product.code),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "code": product.code,
            "name": product.name,
            "description": product.description,
            "sale_price": product.sale_price,
            "tax_percentage": product.tax_percentage,
            "is_active": product.is_active,
        }),
    )
    .await;

    Ok(Json(product))
}

// ----------------------------------------------------------------------------
// Entity Handlers (Customers & Suppliers)
// ----------------------------------------------------------------------------

async fn register_entity_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RegisterEntityRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entity = state
        .register_entity_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "CRIAR_ENTIDADE_COMERCIAL",
        "ENTIDADE",
        Some(&entity.id.to_string()),
        Some(&entity.tax_id),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "tax_id": entity.tax_id,
            "name": entity.name,
            "entity_type": entity.entity_type,
            "email": entity.email,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(entity)))
}

async fn list_entities_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(pagination): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let limit = pagination.limit.unwrap_or(50).clamp(1, 200);
    let offset = pagination.offset.unwrap_or(0).max(0);

    let entities = state
        .get_entity_query
        .list(tenant_id, limit, offset)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(entities))
}

async fn get_entity_by_tax_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(tax_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entity = state
        .get_entity_query
        .get_by_tax_id(tenant_id, &tax_id)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| map_domain_error(InventoryError::EntityNotFound(Uuid::nil())))?;

    Ok(Json(entity))
}

async fn get_entity_by_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entity = state
        .get_entity_query
        .get_by_id(tenant_id, id)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| map_domain_error(InventoryError::EntityNotFound(id)))?;

    Ok(Json(entity))
}

async fn update_entity_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEntityRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entity = state
        .update_entity_cmd
        .execute(tenant_id, id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "ATUALIZAR_ENTIDADE_COMERCIAL",
        "ENTIDADE",
        Some(&entity.id.to_string()),
        Some(&entity.tax_id),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "tax_id": entity.tax_id,
            "name": entity.name,
            "entity_type": entity.entity_type,
            "email": entity.email,
            "phone": entity.phone,
            "is_active": entity.is_active,
        }),
    )
    .await;

    Ok(Json(entity))
}

// ----------------------------------------------------------------------------
// Warehouse Handlers
// ----------------------------------------------------------------------------

async fn create_warehouse_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateWarehouseRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let warehouse = state
        .create_warehouse_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "CRIAR_ARMAZEM",
        "ARMAZEM",
        Some(&warehouse.id.to_string()),
        Some(&warehouse.code),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "code": warehouse.code,
            "name": warehouse.name,
            "address": warehouse.address_detail,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(warehouse)))
}

async fn list_warehouses_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let warehouses = state
        .get_warehouse_query
        .list_all(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(warehouses))
}

async fn get_warehouse_by_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let warehouse = state
        .get_warehouse_query
        .get_by_id(tenant_id, id)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| map_domain_error(InventoryError::WarehouseNotFound(id)))?;

    Ok(Json(warehouse))
}

async fn update_warehouse_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateWarehouseRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let warehouse = state
        .update_warehouse_cmd
        .execute(tenant_id, id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "ATUALIZAR_ARMAZEM",
        "ARMAZEM",
        Some(&warehouse.id.to_string()),
        Some(&warehouse.code),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "code": warehouse.code,
            "name": warehouse.name,
            "address": warehouse.address_detail,
            "is_active": warehouse.is_active,
        }),
    )
    .await;

    Ok(Json(warehouse))
}

// ----------------------------------------------------------------------------
// Batch Handlers (Lotes e Validades)
// ----------------------------------------------------------------------------

async fn create_batch_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateBatchRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let batch = state
        .create_batch_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "CRIAR_LOTE",
        "LOTE",
        Some(&batch.id.to_string()),
        Some(&batch.batch_number),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "product_id": batch.product_id,
            "batch_number": batch.batch_number,
            "expiry_date": batch.expiry_date,
            "is_expired": batch.is_expired,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(batch)))
}

async fn get_batch_by_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let batch = state
        .get_batch_query
        .get_by_id(tenant_id, id)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| map_domain_error(InventoryError::BatchNotFound(id)))?;

    Ok(Json(batch))
}

async fn list_batches_by_product_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(product_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let batches = state
        .get_batch_query
        .list_by_product(tenant_id, product_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(batches))
}

// ----------------------------------------------------------------------------
// Stock Movement Handlers
// ----------------------------------------------------------------------------

async fn receive_purchase_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ReceivePurchaseRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers);

    let movement = state
        .receive_purchase_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "ENTRADA_STOCK_COMPRA",
        "MOVIMENTO_STOCK",
        Some(&movement.id.to_string()),
        movement.document_ref.as_deref(),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "product_id": movement.product_id,
            "warehouse_id": movement.warehouse_id,
            "quantity": movement.quantity,
            "unit_cost": movement.unit_cost,
            "total_cost": movement.total_cost,
            "movement_type": movement.movement_type,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(movement)))
}

async fn transfer_stock_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<TransferStockRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers);

    let movement = state
        .transfer_stock_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "TRANSFERENCIA_ARMAZENS",
        "MOVIMENTO_STOCK",
        Some(&movement.id.to_string()),
        movement.document_ref.as_deref(),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "product_id": movement.product_id,
            "quantity": movement.quantity,
            "movement_type": movement.movement_type,
            "document_ref": movement.document_ref,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(movement)))
}

async fn dispatch_sale_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<DispatchSaleRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers);

    let movement = state
        .dispatch_sale_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "SAIDA_STOCK_VENDA",
        "MOVIMENTO_STOCK",
        Some(&movement.id.to_string()),
        movement.document_ref.as_deref(),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "product_id": movement.product_id,
            "warehouse_id": movement.warehouse_id,
            "quantity": movement.quantity,
            "movement_type": movement.movement_type,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(movement)))
}

async fn adjust_stock_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdjustStockRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers);

    let movement = state
        .adjust_stock_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "AJUSTE_INVENTARIO",
        "MOVIMENTO_STOCK",
        Some(&movement.id.to_string()),
        movement.document_ref.as_deref(),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "product_id": movement.product_id,
            "warehouse_id": movement.warehouse_id,
            "quantity": movement.quantity,
            "movement_type": movement.movement_type,
            "notes": movement.notes,
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(movement)))
}

async fn list_all_stock_balances_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let balances = state
        .get_stock_query
        .list_all_balances(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(balances))
}

async fn get_stock_balance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(product_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let balances = state
        .get_stock_query
        .list_balances_by_product(tenant_id, product_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(balances))
}

async fn get_stock_balance_at_warehouse_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((product_id, warehouse_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let balance = state
        .get_stock_query
        .get_balance(tenant_id, warehouse_id, product_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(balance))
}

async fn list_movements_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<MovementsQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let limit = params.limit.unwrap_or(50).clamp(1, 500);

    let movements = state
        .get_stock_query
        .list_movements(tenant_id, params.product_id, params.warehouse_id, limit)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(movements))
}

async fn process_invoice_issued_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<InvoiceIssuedPayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = headers
        .get("X-Resolved-Tenant-ID")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or(payload.tenant_id);
    let user_id = extract_user_id(&headers);

    let (actor_id, actor_name, ip) = extract_actor_info(&headers);
    let document_number = payload.document_number.clone();
    let document_type = payload.document_type.clone();
    let lines_count = payload.lines.len();

    let result = state
        .process_invoice_issued_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    record_inventory_audit(
        &state.db_pool,
        tenant_id,
        "BAIXA_STOCK_FACTURACAO",
        "MOVIMENTO_STOCK",
        None,
        Some(&document_number),
        Some(&actor_id),
        Some(&actor_name),
        ip.as_deref(),
        serde_json::json!({
            "document_number": document_number,
            "document_type": document_type,
            "lines_count": lines_count,
            "processed": result.processed,
            "movements_count": result.movements_recorded,
            "items_skipped_intangible": result.items_skipped_intangible,
        }),
    )
    .await;

    Ok((StatusCode::OK, Json(result)))
}

pub async fn system_audit_trail_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<SystemAuditTrailQueryParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ProblemDetail>)> {
    ensure_audit_access(&headers)?;
    let tenant_id = extract_tenant_id(&headers)?;

    let limit = params.limit.unwrap_or(150).clamp(1, 500);
    let offset = params.offset.unwrap_or(0).max(0);

    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        "SELECT id, tenant_id, module, action, entity_type, entity_id, document_reference, \
         actor_user_id, actor_name, ip_address::text AS ip_address, details::text AS details, \
         created_at FROM kudiba_audit.system_audit_trail WHERE tenant_id = ",
    );
    builder.push_bind(tenant_id);

    if let Some(ref m) = params.module {
        if !m.trim().is_empty() && m.trim().to_uppercase() != "ALL" {
            builder.push(" AND UPPER(module) = ");
            builder.push_bind(m.trim().to_uppercase());
        }
    }

    if let Some(ref a) = params.action {
        if !a.trim().is_empty() && a.trim().to_uppercase() != "ALL" {
            builder.push(" AND UPPER(action) = ");
            builder.push_bind(a.trim().to_uppercase());
        }
    }

    if let Some(ref q) = params.search {
        let clean_q = q.trim();
        if !clean_q.is_empty() {
            builder.push(" AND (document_reference ILIKE ");
            builder.push_bind(format!("%{}%", clean_q));
            builder.push(" OR action ILIKE ");
            builder.push_bind(format!("%{}%", clean_q));
            builder.push(" OR actor_name ILIKE ");
            builder.push_bind(format!("%{}%", clean_q));
            builder.push(" OR entity_type ILIKE ");
            builder.push_bind(format!("%{}%", clean_q));
            builder.push(")");
        }
    }

    builder.push(" ORDER BY created_at DESC LIMIT ");
    builder.push_bind(limit);
    builder.push(" OFFSET ");
    builder.push_bind(offset);

    let rows = builder
        .build()
        .fetch_all(&state.db_pool)
        .await
        .map_err(|err| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ProblemDetail::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Erro de Base de Dados",
                    &err.to_string(),
                    "DATABASE_ERROR",
                )),
            )
        })?;

    let items: Vec<SystemAuditTrailEntry> = rows
        .iter()
        .map(|r| {
            let details_str: String = r.get("details");
            let details = serde_json::from_str(&details_str).unwrap_or(serde_json::Value::Null);

            SystemAuditTrailEntry {
                id: r.get("id"),
                tenant_id: r.get("tenant_id"),
                module: r.get("module"),
                action: r.get("action"),
                entity_type: r.get("entity_type"),
                entity_id: r.get("entity_id"),
                document_reference: r.get("document_reference"),
                actor_user_id: r.get("actor_user_id"),
                actor_name: r.get("actor_name"),
                ip_address: r.get("ip_address"),
                details,
                created_at: r.get("created_at"),
            }
        })
        .collect();

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM kudiba_audit.system_audit_trail WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "items": items,
        "total": total
    })))
}

async fn dashboard_summary_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let summary = state
        .get_dashboard_summary_query
        .execute(tenant_id)
        .await
        .map_err(map_domain_error)?;
    Ok(Json(summary))
}

async fn tenant_scope_middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let tenant = req
        .headers()
        .get("X-Resolved-Tenant-ID")
        .or_else(|| req.headers().get("X-Tenant-ID"))
        .and_then(|value| value.to_str().ok())
        .and_then(|value| Uuid::parse_str(value.trim()).ok());

    crate::config::with_tenant_context(tenant, next.run(req)).await
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        // Painel Executivo
        .route(
            "/api/v1/inventory/dashboard/summary",
            get(dashboard_summary_handler),
        )
        // Produtos
        .route(
            "/api/v1/inventory/products",
            post(create_product_handler).get(list_products_handler),
        )
        .route(
            "/api/v1/inventory/products/{id}",
            get(get_product_by_id_handler).put(update_product_handler),
        )
        .route(
            "/api/v1/inventory/products/{id}/price",
            patch(update_product_price_handler),
        )
        .route(
            "/api/v1/inventory/products/by-code/{code}",
            get(get_product_by_code_handler),
        )
        // Entidades (Clientes / Fornecedores)
        .route(
            "/api/v1/inventory/entities",
            post(register_entity_handler).get(list_entities_handler),
        )
        .route(
            "/api/v1/inventory/entities/{id}",
            get(get_entity_by_id_handler).put(update_entity_handler),
        )
        .route(
            "/api/v1/inventory/entities/by-tax-id/{tax_id}",
            get(get_entity_by_tax_id_handler),
        )
        // Armazéns
        .route(
            "/api/v1/inventory/warehouses",
            post(create_warehouse_handler).get(list_warehouses_handler),
        )
        .route(
            "/api/v1/inventory/warehouses/{id}",
            get(get_warehouse_by_id_handler).put(update_warehouse_handler),
        )
        // Lotes e Validades
        .route("/api/v1/inventory/batches", post(create_batch_handler))
        .route(
            "/api/v1/inventory/batches/{id}",
            get(get_batch_by_id_handler),
        )
        .route(
            "/api/v1/inventory/products/{product_id}/batches",
            get(list_batches_by_product_handler),
        )
        // Movimentos e Saldos de Stock
        .route(
            "/api/v1/inventory/movements/purchase",
            post(receive_purchase_handler),
        )
        .route(
            "/api/v1/inventory/movements/sale",
            post(dispatch_sale_handler),
        )
        .route(
            "/api/v1/inventory/movements/adjust",
            post(adjust_stock_handler),
        )
        .route(
            "/api/v1/inventory/movements/transfer",
            post(transfer_stock_handler),
        )
        .route("/api/v1/inventory/movements", get(list_movements_handler))
        .route(
            "/api/v1/inventory/stock",
            get(list_all_stock_balances_handler),
        )
        .route(
            "/api/v1/inventory/stock/{product_id}",
            get(get_stock_balance_handler),
        )
        .route(
            "/api/v1/inventory/stock/{product_id}/warehouses/{warehouse_id}",
            get(get_stock_balance_at_warehouse_handler),
        )
        // Eventos e Integrações Assíncronas
        .route(
            "/api/v1/inventory/events/invoice-issued",
            post(process_invoice_issued_handler),
        )
        .route(
            "/api/v1/inventory/events/fiscal-document-issued",
            post(process_invoice_issued_handler),
        )
        .route(
            "/api/v1/inventory/system-audit-trail",
            get(system_audit_trail_handler),
        )
        .layer(axum::middleware::from_fn(tenant_scope_middleware))
        .with_state(state)
}
