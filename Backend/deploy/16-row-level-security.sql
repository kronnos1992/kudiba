-- =============================================================================
-- Kudiba ERP: 16-row-level-security.sql
-- Row-Level Security (RLS) para isolamento hermético multi-tenant
--
-- Idempotente: seguro aplicar em cada base (invoicing, treasury, inventory,
-- accounting). Blocos que não encontram o schema/tabela são ignorados.
--
-- Política: sem app.current_tenant, nenhuma linha tenant-scoped é acessível.
-- FORCE ROW LEVEL SECURITY impede bypass pelo role proprietário das tabelas.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

DO $$
DECLARE
    tbl text;
    sch text;
    targets text[] := ARRAY[
        'kudiba_core.invoices',
        'kudiba_core.series_fiscais',
        'kudiba_core.pos_z_reports',
        'kudiba_core.accounting_outbox',
        'kudiba_audit.fiscal_audit_trail',
        'kudiba_audit.system_audit_trail',
        'kudiba_treasury.cash_registers',
        'kudiba_treasury.cash_sessions',
        'kudiba_treasury.pos_sessions',
        'kudiba_treasury.cash_movements',
        'kudiba_treasury.treasury_receipts',
        'kudiba_treasury.invoice_receivables',
        'kudiba_treasury.invoice_payables',
        'kudiba_treasury.payable_settlements',
        'kudiba_treasury.cash_transfers',
        'kudiba_treasury.bank_statements',
        'kudiba_treasury.bank_statement_lines',
        'kudiba_treasury.bank_accounts',
        'kudiba_treasury.treasury_sequences',
        'kudiba_inventory.warehouses',
        'kudiba_inventory.products',
        'kudiba_inventory.stock_balances',
        'kudiba_inventory.stock_movements',
        'kudiba_inventory.product_batches',
        'kudiba_inventory.entities',
        'kudiba_accounting.chart_of_accounts',
        'kudiba_accounting.journal_entries',
        'kudiba_accounting.journal_lines',
        'kudiba_accounting.journals',
        'kudiba_accounting.fiscal_years',
        'kudiba_accounting.cost_centers',
        'kudiba_accounting.accounting_sequences',
        'kudiba_accounting.processed_events'
    ];
    full_name text;
BEGIN
    FOREACH full_name IN ARRAY targets
    LOOP
        sch := split_part(full_name, '.', 1);
        tbl := split_part(full_name, '.', 2);

        IF NOT EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = sch AND tablename = tbl
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', sch, tbl);
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', sch, tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I.%I', sch, tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I.%I FOR ALL '
            'USING (tenant_id = get_current_tenant_id()) '
            'WITH CHECK (tenant_id = get_current_tenant_id())',
            sch, tbl
        );
    END LOOP;
END $$;
