-- ============================================================================
-- Seed de Dados Profissionais de Tesouraria e Fluxo de Caixa (Mercado Angolano)
-- Base de dados: kudiba_treasury
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_bai_id UUID;
    v_bfa_id UUID := 'b0000000-0000-0000-0000-000000000003'::uuid;
    v_bic_id UUID := 'b0000000-0000-0000-0000-000000000004'::uuid;
    v_bma_id UUID := 'b0000000-0000-0000-0000-000000000005'::uuid;
    v_register_id UUID;
    v_stmt_id UUID := 'd0000000-0000-0000-0000-000000000001'::uuid;
    v_p1 UUID := 'd0000000-0000-0000-0000-000000000011'::uuid;
    v_p2 UUID := 'd0000000-0000-0000-0000-000000000012'::uuid;
    v_p3 UUID := 'd0000000-0000-0000-0000-000000000013'::uuid;
    v_p4 UUID := 'd0000000-0000-0000-0000-000000000014'::uuid;
    v_p5 UUID := 'd0000000-0000-0000-0000-000000000015'::uuid;
    v_p6 UUID := 'd0000000-0000-0000-0000-000000000016'::uuid;
    v_p7 UUID := 'd0000000-0000-0000-0000-000000000017'::uuid;
BEGIN
    -- 1. Contas Bancárias Angolanas com Moedas e Câmbio de Referência BNA
    INSERT INTO kudiba_treasury.bank_accounts (
        id, tenant_id, bank_name, account_number, iban, currency,
        current_balance, reconciled_balance, exchange_rate_to_aoa, is_active
    )
    VALUES (
        'b0000000-0000-0000-0000-000000000002', v_tenant_id,
        'Banco Angolano de Investimentos (BAI)', '0006-0000-1234-5678-90',
        'AO06004000001234567890123', 'AOA', 14500000.0000, 14200000.0000, 1.0000, true
    )
    ON CONFLICT (tenant_id, iban) DO UPDATE
    SET current_balance = EXCLUDED.current_balance,
        reconciled_balance = EXCLUDED.reconciled_balance,
        exchange_rate_to_aoa = EXCLUDED.exchange_rate_to_aoa;

    SELECT id INTO v_bai_id
    FROM kudiba_treasury.bank_accounts
    WHERE tenant_id = v_tenant_id AND iban = 'AO06004000001234567890123';

    UPDATE kudiba_treasury.bank_accounts
    SET current_balance = 14500000.0000, reconciled_balance = 14200000.0000, exchange_rate_to_aoa = 1.0000
    WHERE id = v_bai_id;

    INSERT INTO kudiba_treasury.bank_accounts (id, tenant_id, bank_name, account_number, iban, currency, current_balance, reconciled_balance, exchange_rate_to_aoa, is_active)
    VALUES
        (v_bfa_id, v_tenant_id, 'Banco de Fomento Angola (BFA)', '0006-0000-9876-5432-10', 'AO06000600009876543210987', 'AOA', 8450000.0000, 8450000.0000, 1.0000, true),
        (v_bic_id, v_tenant_id, 'Banco BIC (Moeda Estrangeira)', '0051-0000-5555-4444-33', 'AO06005100005555444433332', 'USD', 15000.0000, 15000.0000, 935.5000, true),
        (v_bma_id, v_tenant_id, 'Banco Millennium Atlântico (BMA)', '0055-0000-7777-8888-99', 'AO06005500007777888899991', 'EUR', 8500.0000, 8500.0000, 1015.2000, true)
    ON CONFLICT (tenant_id, iban) DO UPDATE
    SET current_balance = EXCLUDED.current_balance,
        reconciled_balance = EXCLUDED.reconciled_balance,
        exchange_rate_to_aoa = EXCLUDED.exchange_rate_to_aoa;

    SELECT id INTO v_bfa_id FROM kudiba_treasury.bank_accounts
    WHERE tenant_id = v_tenant_id AND iban = 'AO06000600009876543210987';
    SELECT id INTO v_bic_id FROM kudiba_treasury.bank_accounts
    WHERE tenant_id = v_tenant_id AND iban = 'AO06005100005555444433332';
    SELECT id INTO v_bma_id FROM kudiba_treasury.bank_accounts
    WHERE tenant_id = v_tenant_id AND iban = 'AO06005500007777888899991';

    SELECT id INTO v_register_id
    FROM kudiba_treasury.cash_registers
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at
    LIMIT 1;

    -- 2. Contas a Pagar a Fornecedores (Invoice Payables)
    -- P1: AngoAlissar
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p1, v_tenant_id, 'SUP-ALIS', 'AngoAlissar Comércio Geral', '5418029981', 'FT ALIS/2026/0891',
        'OPERATIONAL', 'FORNECEDORES_MERCADORIAS', 'AOA', 3450000.0000, 0.00, 0.00,
        3450000.0000, 0.00, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE - INTERVAL '15 days',
        'TRANSFERENCIA', 'OUTSTANDING', 'Fatura de bens alimentares a granel (arroz, óleo, açúcar)'
    ) ON CONFLICT DO NOTHING;

    -- P2: Refriango Bebidas SA (Parcialmente paga)
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p2, v_tenant_id, 'SUP-REFR', 'Refriango Bebidas SA', '5403018820', 'FT REFR/2026/1204',
        'OPERATIONAL', 'FORNECEDORES_MERCADORIAS', 'AOA', 4800000.0000, 0.00, 0.00,
        4800000.0000, 2000000.0000, CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE - INTERVAL '20 days',
        'TRANSFERENCIA', 'PARTIALLY_PAID', 'Paletes de refrigerantes e águas Pura'
    ) ON CONFLICT DO NOTHING;

    -- Registo da liquidação parcial de Refriango
    INSERT INTO kudiba_treasury.payable_settlements (
        id, tenant_id, payable_id, bank_account_id, amount_paid, payment_method, payment_reference,
        settled_at, operator_user_id, notes
    ) VALUES (
        'd0000000-0000-0000-0000-000000000021', v_tenant_id, v_p2, v_bai_id,
        2000000.0000, 'TRANSFERENCIA', 'TRF-BAI-7849201',
        NOW() - INTERVAL '5 days', 'admin@kudiba.ao', 'Pagamento 1ª tranche 2.000.000 Kz'
    ) ON CONFLICT DO NOTHING;

    -- P3: NCR Angola Informática (Investimento em TI)
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p3, v_tenant_id, 'SUP-NCR', 'NCR Angola Informática', '5408012399', 'FT NCR/2026/0455',
        'INVESTMENT', 'EQUIPAMENTOS', 'AOA', 2900000.0000, 0.00, 0.00,
        2900000.0000, 0.00, CURRENT_DATE + INTERVAL '12 days', CURRENT_DATE - INTERVAL '10 days',
        'TRANSFERENCIA', 'OUTSTANDING', 'Aquisição de 3 Servidores Rack e UPS APC'
    ) ON CONFLICT DO NOTHING;

    -- P4: Pumangol Combustíveis
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p4, v_tenant_id, 'SUP-PUM', 'Pumangol Combustíveis Lda', '5412093842', 'FT PUM/2026/5521',
        'OPERATIONAL', 'SERVICOS_TERCEIROS', 'AOA', 1120000.0000, 0.00, 0.00,
        1120000.0000, 0.00, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE - INTERVAL '12 days',
        'MULTICAIXA', 'OUTSTANDING', 'Abastecimento gasóleo frota de camiões de distribuição'
    ) ON CONFLICT DO NOTHING;

    -- P5: Deloitte & Touche Angola (Com Retenção na Fonte AGT de 6.5%)
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p5, v_tenant_id, 'SUP-DEL', 'Deloitte & Touche Angola Lda', '5401099823', 'FT DEL/2026/0112',
        'OPERATIONAL', 'SERVICOS_TERCEIROS', 'AOA', 3000000.0000, 6.50, 195000.0000,
        2805000.0000, 0.00, CURRENT_DATE + INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days',
        'TRANSFERENCIA', 'OUTSTANDING', 'Auditoria fiscal anual e consultoria tributária. Retenção de 6.5% a entregar à AGT.'
    ) ON CONFLICT DO NOTHING;

    -- P6: ENDE - Eletricidade
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p6, v_tenant_id, 'PUB-ENDE', 'ENDE - Empresa Nacional de Eletricidade', '5400000010', 'FT ENDE/10-2026',
        'OPERATIONAL', 'SERVICOS_TERCEIROS', 'AOA', 450000.0000, 0.00, 0.00,
        450000.0000, 0.00, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE - INTERVAL '8 days',
        'GPO_REFERENCE', 'OUTSTANDING', 'Consumo de energia elétrica sede e câmaras frigoríficas'
    ) ON CONFLICT DO NOTHING;

    -- P7: EPAL - Águas
    INSERT INTO kudiba_treasury.invoice_payables (
        id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
        activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
        net_payable, amount_paid, due_date, issue_date, payment_method, status, notes
    ) VALUES (
        v_p7, v_tenant_id, 'PUB-EPAL', 'EPAL - Empresa Pública de Águas de Luanda', '5400000028', 'FT EPAL/10-2026',
        'OPERATIONAL', 'SERVICOS_TERCEIROS', 'AOA', 180000.0000, 0.00, 0.00,
        180000.0000, 0.00, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE - INTERVAL '8 days',
        'GPO_REFERENCE', 'OUTSTANDING', 'Consumo de água industrial e sanitária'
    ) ON CONFLICT DO NOTHING;

    -- 3. Transferências Internas entre Contas e Caixas (Cash Transfers)
    INSERT INTO kudiba_treasury.cash_transfers (
        id, tenant_id, transfer_number, source_type, source_id, target_type, target_id,
        amount, fee_amount, currency, status, operator_user_id, notes, transferred_at
    ) VALUES
        ('d0000000-0000-0000-0000-000000000031', v_tenant_id, 'TRF-INT-2026-001', 'REGISTER', v_register_id, 'BANK', v_bai_id, 1500000.0000, 0.0000, 'AOA', 'COMPLETED', 'admin@kudiba.ao', 'Sangria de fim de turno para depósito bancário no BAI', NOW() - INTERVAL '3 days'),
        ('d0000000-0000-0000-0000-000000000032', v_tenant_id, 'TRF-INT-2026-002', 'BANK', v_bai_id, 'BANK', v_bfa_id, 3000000.0000, 350.0000, 'AOA', 'COMPLETED', 'admin@kudiba.ao', 'Reforço de tesouraria conta BFA para pagamento a fornecedores. Comissão STC 350 Kz.', NOW() - INTERVAL '2 days'),
        ('d0000000-0000-0000-0000-000000000033', v_tenant_id, 'TRF-INT-2026-003', 'BANK', v_bfa_id, 'REGISTER', v_register_id, 250000.0000, 0.0000, 'AOA', 'COMPLETED', 'admin@kudiba.ao', 'Levantamento para fundo de maneio de trocos em numerário', NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING;

    -- 4. Extrato Bancário e Reconciliação (Banco BAI)
    INSERT INTO kudiba_treasury.bank_statements (
        id, tenant_id, bank_account_id, reference_period, start_balance, end_balance,
        statement_date, file_name, status
    ) VALUES (
        v_stmt_id, v_tenant_id, v_bai_id, to_char(CURRENT_DATE, 'YYYY-MM'),
        10500000.0000, 14500000.0000,
        CURRENT_DATE, 'Extrato_BAI_Outubro_2026.pdf', 'OPEN'
    ) ON CONFLICT DO NOTHING;

    -- Linhas do Extrato
    INSERT INTO kudiba_treasury.bank_statement_lines (
        id, statement_id, tenant_id, line_date, description, document_ref, amount,
        balance_after, movement_type, is_reconciled, matched_type, reconciled_at, reconciled_by
    ) VALUES
        ('d0000000-0000-0000-0000-000000000041', v_stmt_id, v_tenant_id, CURRENT_DATE - INTERVAL '4 days', 'Crédito Depósito Numerário Balcão Talatona', 'DEP-BAI-0982', 1500000.0000, 12000000.0000, 'CREDIT', true, 'TRANSFER', NOW() - INTERVAL '3 days', 'admin@kudiba.ao'),
        ('d0000000-0000-0000-0000-000000000042', v_stmt_id, v_tenant_id, CURRENT_DATE - INTERVAL '3 days', 'Liquidação Lote TPA EMIS Terminal #10294', 'TPA-EMIS-449102', 3850000.0000, 15850000.0000, 'CREDIT', true, 'RECEIPT', NOW() - INTERVAL '2 days', 'admin@kudiba.ao'),
        ('d0000000-0000-0000-0000-000000000043', v_stmt_id, v_tenant_id, CURRENT_DATE - INTERVAL '3 days', 'Comissão Gestão e Aluguer TPA EMIS Out/2026', 'DEB-EMIS-0091', -25000.0000, 15825000.0000, 'DEBIT', true, 'COMMISSION', NOW() - INTERVAL '2 days', 'admin@kudiba.ao'),
        ('d0000000-0000-0000-0000-000000000044', v_stmt_id, v_tenant_id, CURRENT_DATE - INTERVAL '2 days', 'Trf Interbancária Enviada p/ BFA Reforço', 'STC-AO-8841290', -3000350.0000, 12824650.0000, 'DEBIT', true, 'TRANSFER', NOW() - INTERVAL '2 days', 'admin@kudiba.ao'),
        ('d0000000-0000-0000-0000-000000000045', v_stmt_id, v_tenant_id, CURRENT_DATE - INTERVAL '1 day', 'Recebimento Factura FT-2026/0048 Soc. Construções', 'TRF-CLI-77124', 3675350.0000, 16500000.0000, 'CREDIT', true, 'RECEIPT', NOW() - INTERVAL '1 day', 'admin@kudiba.ao'),
        ('d0000000-0000-0000-0000-000000000046', v_stmt_id, v_tenant_id, CURRENT_DATE - INTERVAL '1 day', 'Pagamento Refriango 1ª Tranche FT REFR/2026/1204', 'TRF-BAI-7849201', -2000000.0000, 14500000.0000, 'DEBIT', true, 'PAYABLE', NOW() - INTERVAL '1 day', 'admin@kudiba.ao'),
        ('d0000000-0000-0000-0000-000000000047', v_stmt_id, v_tenant_id, CURRENT_DATE, 'Manutenção de Conta à Ordem Banco BAI Outubro', 'DEB-MAN-202610', -4500.0000, 14495500.0000, 'DEBIT', false, NULL, NULL, NULL)
    ON CONFLICT DO NOTHING;

END $$;
