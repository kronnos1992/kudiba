ALTER TABLE kudiba_inventory.stock_movements
    ADD COLUMN IF NOT EXISTS supplier_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_stock_movements_supplier'
          AND conrelid = 'kudiba_inventory.stock_movements'::regclass
    ) THEN
        ALTER TABLE kudiba_inventory.stock_movements
            ADD CONSTRAINT fk_stock_movements_supplier
            FOREIGN KEY (supplier_id)
            REFERENCES kudiba_inventory.entities(id)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier
    ON kudiba_inventory.stock_movements(supplier_id)
    WHERE supplier_id IS NOT NULL;
