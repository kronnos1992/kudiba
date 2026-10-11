use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::dto::{
    AdjustStockRequest, CreateBatchRequest, CreateProductRequest, CreateWarehouseRequest,
    DispatchSaleRequest, InvoiceIssuedPayload, ReceivePurchaseRequest, RegisterEntityRequest,
    TransferStockRequest, UpdateProductPriceRequest,
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

    Ok((StatusCode::CREATED, Json(movement)))
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

    let result = state
        .process_invoice_issued_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::OK, Json(result)))
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        // Produtos
        .route(
            "/api/v1/inventory/products",
            post(create_product_handler).get(list_products_handler),
        )
        .route(
            "/api/v1/inventory/products/{id}",
            get(get_product_by_id_handler),
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
            "/api/v1/inventory/entities/by-tax-id/{tax_id}",
            get(get_entity_by_tax_id_handler),
        )
        // Armazéns
        .route(
            "/api/v1/inventory/warehouses",
            post(create_warehouse_handler).get(list_warehouses_handler),
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
        .with_state(state)
}
