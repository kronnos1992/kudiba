-- Kudiba ERP: 33-treasury-cash-movement-idempotency.sql
-- Chave de idempotência para movimentos de caixa originados no checkout POS.
-- VALUES NULL continuam permitidos: movimentos manuais não usam esta chave.

ALTER TABLE kudiba_treasury.cash_movements
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_cash_movement_idempotency'
          AND conrelid = 'kudiba_treasury.cash_movements'::regclass
    ) THEN
        ALTER TABLE kudiba_treasury.cash_movements
            ADD CONSTRAINT uq_cash_movement_idempotency
            UNIQUE (tenant_id, idempotency_key);
    END IF;
END $$;
