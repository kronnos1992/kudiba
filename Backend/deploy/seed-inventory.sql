BEGIN;

ALTER TABLE kudiba_inventory.products ADD COLUMN IF NOT EXISTS ref_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_products_ref_id ON kudiba_inventory.products(tenant_id, ref_id) WHERE ref_id IS NOT NULL;


    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER', 'LEGAL_ENTITY', '5408877665', 'Refriango Indústria Lda', 'Refriango', 'comercial@refriango.ao', '+244 923 111 222',
        'AO', 'Luanda', 'Viana', 'Complexo Industrial do Kikuxi, Viana', 'AO06004000001234567890101', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER', 'LEGAL_ENTITY', '5403322114', 'Nova Cimangola S.A.', 'Nova Cimangola', 'vendas@cimangola.co.ao', '+244 923 222 333',
        'AO', 'Luanda', 'Cacuaco', 'Estrada de Cacuaco km 8', 'AO06004000002345678901202', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER', 'LEGAL_ENTITY', '5412233445', 'AngoAlissar Alimentos Lda', 'AngoAlissar', 'contacto@angoalissar.com', '+244 923 333 444',
        'AO', 'Luanda', 'Viana', 'Pólo Industrial de Viana, Rua 4', 'AO06004000003456789012303', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER', 'LEGAL_ENTITY', '5401122334', 'NCR Angola Comercial Lda', 'NCR Angola', 'empresas@ncrangola.com', '+244 923 444 555',
        'AO', 'Luanda', 'Luanda', 'Avenida Lenine 62, Ingombota', 'AO06004000004567890123404', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'SUPPLIER', 'LEGAL_ENTITY', '5406655443', 'Pumangol Lda', 'Pumangol', 'corporate@pumangol.ao', '+244 923 555 666',
        'AO', 'Luanda', 'Luanda', 'Edifício Presidente Business Park', 'AO06004000005678901234505', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER', 'LEGAL_ENTITY', '5417892341', 'Unitel S.A.', 'Unitel', 'corporate@unitel.ao', '+244 923 000 111',
        'AO', 'Luanda', 'Maianga', 'Rua do Cergal 10, Maianga', 'AO06004000006789012345606', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'CUSTOMER', 'LEGAL_ENTITY', '5401234567', 'Banco BAI S.A.', 'BAI', 'apoio@bancobai.ao', '+244 222 693 800',
        'AO', 'Luanda', 'Luanda', 'Avenida Lenine 35, Luanda', 'AO06004000007890123456707', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'BOTH', 'LEGAL_ENTITY', '5400012345', 'Sonangol Distribuidora E.P.', 'Sonangol', 'info@sonangol.co.ao', '+244 226 642 000',
        'AO', 'Luanda', 'Luanda', 'Rua Rainha Ginga 29, Luanda', 'AO06004000008901234567808', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'PROD-001', 'REF-ARR-01', '5600123400001', 'Arroz Agulha Kudiba 5Kg', 'Saco de arroz agulha selecionado 5Kg', 'P',
        true, false, 'UN', 4500.0000, 3200.0000, 3200.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'PROD-002', 'REF-OLE-01', '5600123400002', 'Óleo Alimentar Kudiba 1L', 'Garrafa de óleo alimentar 100% vegetal 1L', 'P',
        true, true, 'UN', 1850.0000, 1300.0000, 1300.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'PROD-003', 'REF-FAR-01', '5600123400003', 'Farinha de Trigo Nacional 1Kg', 'Farinha de trigo fina tipo 55 - Cesta Básica', 'P',
        true, true, 'KG', 950.0000, 680.0000, 680.0000,
        'IVA', 'NOR', 0.00, 'M04', 'Isenção - Bens da Cesta Básica', false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'PROD-004', 'REF-ACU-01', '5600123400004', 'Açúcar Branco Kudiba 1Kg', 'Açúcar refinado branco nacional - Cesta Básica', 'P',
        true, false, 'KG', 1100.0000, 800.0000, 800.0000,
        'IVA', 'NOR', 0.00, 'M04', 'Isenção - Bens da Cesta Básica', false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'PROD-005', 'REF-FEI-01', '5600123400005', 'Feijão Manteiga Nacional 1Kg', 'Feijão manteiga de produção nacional 1Kg', 'P',
        true, false, 'KG', 1600.0000, 1150.0000, 1150.0000,
        'IVA', 'NOR', 0.00, 'M04', 'Isenção - Bens da Cesta Básica', false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'PROD-006', 'REF-LEI-01', '5600123400006', 'Leite UHT Meio Gordo 1L', 'Leite longa vida meio gordo enriquecido 1L', 'P',
        true, true, 'UN', 1450.0000, 1050.0000, 1050.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'PRD-005', 'REF-NB-HP', '5600123400007', 'Computador Portátil HP ProBook 450 G10', 'Intel Core i7, 16GB RAM, 512GB SSD NVMe, 15.6 FHD', 'P',
        true, false, 'UN', 450000.0000, 340000.0000, 340000.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'PRD-006', 'REF-MON-DELL', '5600123400008', 'Monitor LED 24 polegadas Dell P2422H', 'Painel IPS Full HD, HDMI/DP/VGA, Hub USB regulável', 'P',
        true, false, 'UN', 125000.0000, 92000.0000, 92000.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'PRD-007', 'REF-TECL-LOG', '5600123400009', 'Combo Teclado e Rato Sem Fios Logitech MK270', 'Conexão sem fios 2.4GHz, autonomia de até 36 meses', 'P',
        true, false, 'UN', 22500.0000, 15500.0000, 15500.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'PRD-008', 'REF-IMP-HP', '5600123400010', 'Impressora Multifunções HP LaserJet Pro M428fdw', 'Impressão laser mono, scanner frente e verso, Wi-Fi', 'P',
        true, false, 'UN', 320000.0000, 245000.0000, 245000.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'SRV-001', 'REF-SRV-TI', NULL, 'Consultoria e Suporte Técnico TI', 'Serviços especializados de consultoria e suporte de sistemas', 'S',
        false, false, 'UN', 150000.0000, 0.0000, 0.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '30000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'SRV-002', 'REF-SRV-REDES', NULL, 'Serviços de Manutenção e Rede', 'Instalação, configuração de cablagem estruturada e routers', 'S',
        false, false, 'UN', 85000.0000, 0.0000, 0.0000,
        'IVA', 'NOR', 14.00, NULL, NULL, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    

    INSERT INTO kudiba_inventory.product_batches (
        id, tenant_id, product_id, batch_number, manufacture_date, expiry_date
    ) VALUES (
        '40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'LOTE-OLEO-2026-A1', '2026-03-01', '2027-03-01'
    ) ON CONFLICT (product_id, batch_number) DO NOTHING;
    

    INSERT INTO kudiba_inventory.product_batches (
        id, tenant_id, product_id, batch_number, manufacture_date, expiry_date
    ) VALUES (
        '40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'LOTE-TRIGO-2026-T2', '2026-05-10', '2027-05-10'
    ) ON CONFLICT (product_id, batch_number) DO NOTHING;
    

    INSERT INTO kudiba_inventory.product_batches (
        id, tenant_id, product_id, batch_number, manufacture_date, expiry_date
    ) VALUES (
        '40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'LOTE-LEITE-2026-L4', '2026-08-01', '2027-02-01'
    ) ON CONFLICT (product_id, batch_number) DO NOTHING;
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1250.0000, 50.0000, 200.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 2400.0000, 100.0000, 300.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 1800.0000, 0.0000, 250.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 1500.0000, 50.0000, 200.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 900.0000, 0.0000, 150.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 1100.0000, 40.0000, 200.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 35.0000, 5.0000, 10.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008', 60.0000, 4.0000, 15.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', 120.0000, 10.0000, 30.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', 18.0000, 2.0000, 5.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f3c073b8-c250-454b-a0db-0bcb9e0c172f', '30000000-0000-0000-0000-000000000001', 600.0000, 0.0000, 100.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f3c073b8-c250-454b-a0db-0bcb9e0c172f', '30000000-0000-0000-0000-000000000002', 850.0000, 0.0000, 150.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f3c073b8-c250-454b-a0db-0bcb9e0c172f', '30000000-0000-0000-0000-000000000003', 700.0000, 0.0000, 100.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f3c073b8-c250-454b-a0db-0bcb9e0c172f', '30000000-0000-0000-0000-000000000007', 12.0000, 0.0000, 5.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    

    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f3c073b8-c250-454b-a0db-0bcb9e0c172f', '30000000-0000-0000-0000-000000000008', 25.0000, 0.0000, 5.0000, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    
DELETE FROM kudiba_inventory.stock_movements WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, 'IN_PURCHASE',
        1500.0000, 3200.0000, 4800000.0000, 3200.0000, 'V/FT 2026/8901', 'Compra inicial AngoAlissar',
        '10000000-0000-0000-0000-000000000001', '2026-05-02 08:30:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'IN_PURCHASE',
        3000.0000, 1300.0000, 3900000.0000, 1300.0000, 'V/FT 2026/4432', 'Entrada Refriango',
        '10000000-0000-0000-0000-000000000001', '2026-05-05 09:15:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', NULL, 'IN_PURCHASE',
        50.0000, 340000.0000, 17000000.0000, 340000.0000, 'V/FT 2026/1129', 'Remessa NCR Informática',
        '10000000-0000-0000-0000-000000000001', '2026-05-10 11:00:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008', NULL, 'IN_PURCHASE',
        80.0000, 92000.0000, 7360000.0000, 92000.0000, 'V/FT 2026/1130', 'Monitores Dell NCR',
        '10000000-0000-0000-0000-000000000001', '2026-05-12 14:20:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', NULL, 'OUT_SALE',
        8.0000, 340000.0000, 2720000.0000, 340000.0000, 'FT 2026B/000017', 'Venda Unitel S.A.',
        '10000000-0000-0000-0000-000000000001', '2026-06-14 11:35:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, 'OUT_TRANSFER',
        300.0000, 3200.0000, 960000.0000, 3200.0000, 'TR-2026-001', 'Abastecimento Armazém Cazenga',
        '10000000-0000-0000-0000-000000000001', '2026-07-05 10:00:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f3c073b8-c250-454b-a0db-0bcb9e0c172f', '30000000-0000-0000-0000-000000000001', NULL, 'IN_TRANSFER',
        300.0000, 3200.0000, 960000.0000, 3200.0000, 'TR-2026-001', 'Recebido da Sede Luanda',
        '10000000-0000-0000-0000-000000000001', '2026-07-05 14:30:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', NULL, 'OUT_SALE',
        12.0000, 340000.0000, 4080000.0000, 340000.0000, 'FT 2026B/000021', 'Venda Angola Telecom',
        '10000000-0000-0000-0000-000000000001', '2026-08-14 11:15:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'IN_PURCHASE',
        1000.0000, 1300.0000, 1300000.0000, 1300.0000, 'V/FT 2026/7821', 'Reforço de stock Refriango',
        '10000000-0000-0000-0000-000000000001', '2026-09-05 09:00:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', NULL, 'OUT_SALE',
        5.0000, 340000.0000, 1700000.0000, 340000.0000, 'FT 2026B/000026', 'Venda TAAG Linhas Aéreas',
        '10000000-0000-0000-0000-000000000001', '2026-10-25 14:00:00+00'
    );
    

    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, 'IN_ADJUSTMENT',
        50.0000, 3200.0000, 160000.0000, 3200.0000, 'AJ-2026-10', 'Ajuste de inventário físico mensal',
        '10000000-0000-0000-0000-000000000001', '2026-10-25 16:30:00+00'
    );
    
COMMIT;