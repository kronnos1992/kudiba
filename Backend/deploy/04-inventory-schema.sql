-- ============================================================================
-- Kudiba ERP: Schema do Microsserviço de Inventário & Catálogo
-- Base de dados: kudiba_inventory
-- Conformidade: Decreto Presidencial n.º 71/25 (RJFDE) e Decreto Executivo n.º 385/20 (SAF-T AO v1.01_01)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_inventory;

-- 1. TIPOS ENUMERADOS DE DOMÍNIO
DO $$ BEGIN
    CREATE TYPE kudiba_inventory.entity_kind AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_inventory.tax_id_kind AS ENUM ('LEGAL_ENTITY', 'NATURAL_PERSON_BI', 'FINAL_CONSUMER', 'FOREIGN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_inventory.product_kind AS ENUM ('P', 'S', 'O', 'E', 'I');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_inventory.stock_movement_kind AS ENUM (
        'IN_PURCHASE',
        'IN_TRANSFER',
        'IN_ADJUSTMENT',
        'OUT_SALE',
        'OUT_TRANSFER',
        'OUT_WASTE',
        'OUT_ADJUSTMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CLIENTES E FORNECEDORES (COM VALIDAÇÃO DE NIF ANGOLANO)
CREATE TABLE IF NOT EXISTS kudiba_inventory.entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_type kudiba_inventory.entity_kind NOT NULL DEFAULT 'CUSTOMER',
    tax_id_type kudiba_inventory.tax_id_kind NOT NULL,
    tax_id VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_withholding_agent BOOLEAN NOT NULL DEFAULT FALSE,
    country_code VARCHAR(2) NOT NULL DEFAULT 'AO',
    province VARCHAR(100),
    city VARCHAR(100),
    address_detail TEXT,
    iban VARCHAR(34),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_tenant_tax_id UNIQUE (tenant_id, tax_id)
);

CREATE INDEX IF NOT EXISTS idx_entities_tenant ON kudiba_inventory.entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_tax_id ON kudiba_inventory.entities(tenant_id, tax_id);

-- 3. ARMAZÉNS (VINCULADOS A FILIAIS DO KUDIBA AUTH)
CREATE TABLE IF NOT EXISTS kudiba_inventory.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    address_detail TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_warehouse_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_branch ON kudiba_inventory.warehouses(tenant_id, branch_id);

-- 4. CATÁLOGO DE ARTIGOS E SERVIÇOS INTANGÍVEIS
CREATE TABLE IF NOT EXISTS kudiba_inventory.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    product_type kudiba_inventory.product_kind NOT NULL DEFAULT 'P',
    is_stockable BOOLEAN NOT NULL DEFAULT TRUE,
    track_lots BOOLEAN NOT NULL DEFAULT FALSE,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
    sale_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    current_cmp NUMERIC(15, 4) NOT NULL DEFAULT 0,
    tax_type VARCHAR(10) NOT NULL DEFAULT 'IVA',
    tax_code VARCHAR(10) NOT NULL DEFAULT 'NOR',
    tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 14.00,
    exemption_reason_code VARCHAR(10),
    exemption_reason_text VARCHAR(255),
    has_withholding_tax BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_product_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON kudiba_inventory.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON kudiba_inventory.products(tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_type ON kudiba_inventory.products(tenant_id, product_type);

-- 5. SALDOS DE INVENTÁRIO (APENAS PARA BENS FÍSICOS is_stockable = TRUE)
CREATE TABLE IF NOT EXISTS kudiba_inventory.stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES kudiba_inventory.warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES kudiba_inventory.products(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 4) NOT NULL DEFAULT 0,
    quantity_reserved NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reorder_point NUMERIC(15, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_product_warehouse UNIQUE (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON kudiba_inventory.stock_balances(warehouse_id);

-- 6. LOTES E VALIDADES
CREATE TABLE IF NOT EXISTS kudiba_inventory.product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES kudiba_inventory.products(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    manufacture_date DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_product_batch UNIQUE (product_id, batch_number)
);

-- 7. MOVIMENTOS DE STOCK (AUDITORIA, VALORIZAÇÃO E RECÁLCULO DE CMP)
CREATE TABLE IF NOT EXISTS kudiba_inventory.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES kudiba_inventory.warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES kudiba_inventory.products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES kudiba_inventory.product_batches(id) ON DELETE SET NULL,
    movement_type kudiba_inventory.stock_movement_kind NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_cost NUMERIC(15, 4) NOT NULL,
    total_cost NUMERIC(15, 4) NOT NULL,
    resulting_cmp NUMERIC(15, 4) NOT NULL,
    document_ref VARCHAR(50),
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON kudiba_inventory.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON kudiba_inventory.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON kudiba_inventory.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON kudiba_inventory.stock_movements(created_at DESC);
