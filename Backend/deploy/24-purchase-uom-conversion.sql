-- ============================================================================
-- Kudiba ERP: Conversão Automática de Unidade de Compra -> Unidade de Venda
-- Base de dados: kudiba_inventory
-- Permite comprar em grosso (ex.: CX com 50 UN) e movimentar/vender à unidade.
-- ============================================================================

ALTER TABLE kudiba_inventory.products
    ADD COLUMN IF NOT EXISTS purchase_unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
    ADD COLUMN IF NOT EXISTS purchase_conversion_factor NUMERIC(15, 4) NOT NULL DEFAULT 1;

ALTER TABLE kudiba_inventory.products
    DROP CONSTRAINT IF EXISTS chk_products_purchase_conversion_positive;

ALTER TABLE kudiba_inventory.products
    ADD CONSTRAINT chk_products_purchase_conversion_positive
    CHECK (purchase_conversion_factor > 0);
