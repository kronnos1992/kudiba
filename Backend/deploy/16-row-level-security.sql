-- =============================================================================
-- Kudiba ERP: 16-row-level-security.sql
-- Row-Level Security (RLS) para isolamento hermético multi-tenant
--
-- Idempotente: seguro aplicar em cada base (invoicing, treasury, inventory,
-- accounting). Blocos que não encontram o schema/tabela são ignorados.
--
-- Política: se app.current_tenant estiver vazio (jobs de sistema / migrações),
-- o acesso não é filtrado. Com tenant definido, apenas linhas desse tenant.
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
        'kudiba_treasury.cash_registers',
        'kudiba_treasury.cash_sessions',
        'kudiba_treasury.cash_movements',
        'kudiba_treasury.treasury_receipts',
        'kudiba_treasury.invoice_receivables',
        'kudiba_treasury.bank_accounts',
        'kudiba_inventory.warehouses',
        'kudiba_inventory.products',
        'kudiba_inventory.stock_balances',
        'kudiba_inventory.stock_movements',
        'kudiba_inventory.entities',
        'kudiba_accounting.chart_of_accounts',
        'kudiba_accounting.journal_entries',
        'kudiba_accounting.journals',
        'kudiba_accounting.fiscal_years'
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
            'USING (get_current_tenant_id() IS NULL OR tenant_id = get_current_tenant_id()) '
            'WITH CHECK (get_current_tenant_id() IS NULL OR tenant_id = get_current_tenant_id())',
            sch, tbl
        );
    END LOOP;
END $$;
