-- =============================================================================
-- Kudiba ERP — Migração 23: Suporte a Pagamentos Parciais de Faturas
-- Base de dados: kudiba_treasury
-- =============================================================================

ALTER TABLE kudiba_treasury.invoice_receivables
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(15, 4);

UPDATE kudiba_treasury.invoice_receivables
SET remaining_amount = CASE 
    WHEN status = 'SETTLED' THEN 0 
    ELSE gross_total - COALESCE(paid_amount, 0) 
END
WHERE remaining_amount IS NULL;
