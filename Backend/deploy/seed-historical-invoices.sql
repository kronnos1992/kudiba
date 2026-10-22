BEGIN;

INSERT INTO kudiba_core.series_fiscais (id, tenant_id, document_type, series_code, fiscal_year, current_sequence, last_hash, is_active)
VALUES 
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'FT', '2026B', 2026, 20, '', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'FR', '2026B', 2026, 20, '', true)
ON CONFLICT (tenant_id, document_type, series_code, fiscal_year) DO UPDATE SET current_sequence = 20, is_active = true;


    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '8dca8910-6ddf-4fdd-b9e2-e25324a34dfc', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000001', 1, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Unitel S.A.', '5417892341', 'Rua do Cergal 10, Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2250000.0000, 315000.0000, 2565000.0000,
        0.0000, 0.0000, '99755f2d9131522cdd2ca23dc47396918953fe0b9d3c392a980459458e0d8267', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '9975', '1', false, 'REGIME_GERAL',
        '2026-01-08 10:15:00+00', '2026-01-08 10:15:00+00', '2026-01-08 10:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '3009079c-c044-4649-bdf4-937133d06f03', '8dca8910-6ddf-4fdd-b9e2-e25324a34dfc', 1, 'PRD-005', 'Computador Portátil HP ProBook', 5.0000, 450000.0000, 0.0000, 14.00, NULL, 2565000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '342abef3-d7fe-4031-8c03-53b41751aed0', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000001', 1, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Consumidor Final', '999999999', 'Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 12100.0000, 1295.0000, 13395.0000,
        0.0000, 0.0000, '15dd555e30ac0f9d55d7fe4ee805d546e6eb30be54465db4f54f23a4e22359b8', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '15DD', '1', false, 'REGIME_GERAL',
        '2026-01-16 14:30:00+00', '2026-01-16 14:30:00+00', '2026-01-16 14:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '0d949289-8648-4b02-a351-79337b909f31', '342abef3-d7fe-4031-8c03-53b41751aed0', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 5.0000, 1850.0000, 0.0000, 14.00, NULL, 10545.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'b88e54c6-a5d4-4d7a-888b-a84bc351a13d', '342abef3-d7fe-4031-8c03-53b41751aed0', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 3.0000, 950.0000, 0.0000, 0.00, 'M04', 2850.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '9f7083f6-4528-44bd-8554-a5091ce50e56', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000002', 2, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Banco BAI S.A.', '5401234567', 'Avenida Lenine 35, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1200000.0000, 168000.0000, 1368000.0000,
        0.0000, 0.0000, 'cca78ebd8135a97b0536ff679182dfcd9bf10c3b5fa5ac85afb7f8f3b49afc70', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'CCA7', '1', false, 'REGIME_GERAL',
        '2026-01-24 11:20:00+00', '2026-01-24 11:20:00+00', '2026-01-24 11:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ceb8e51b-163d-4f25-89ff-964ca70100cb', '9f7083f6-4528-44bd-8554-a5091ce50e56', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 8.0000, 150000.0000, 0.0000, 14.00, NULL, 1368000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '8c423ab0-d913-4550-84bc-d0cd2beff127', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000002', 2, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hipermercado Kero', '5412233445', 'Nova Vida, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 14050.0000, 0.0000, 14050.0000,
        0.0000, 0.0000, '4488848b55e5bd226289f24382a4b410124403072407b0ef3b60872436f01318', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '4488', '1', false, 'REGIME_GERAL',
        '2026-01-29 16:45:00+00', '2026-01-29 16:45:00+00', '2026-01-29 16:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '1872d158-23ed-43e7-9b71-d851c89ac38e', '8c423ab0-d913-4550-84bc-d0cd2beff127', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 9.0000, 950.0000, 0.0000, 0.00, 'M04', 8550.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '11d5c180-4757-4e42-8c80-05a81797a210', '8c423ab0-d913-4550-84bc-d0cd2beff127', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 5.0000, 1100.0000, 0.0000, 0.00, 'M04', 5500.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '002f53d1-8c81-4b82-8762-8dc9ad36e756', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000003', 3, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Sonangol Distribuidora E.P.', '5400012345', 'Rua Rainha Ginga 29, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 5040000.0000, 705600.0000, 5745600.0000,
        0.0000, 0.0000, '9d008a158c808b642953731cdf0634189d338b4fa70d0c875ea7ea5ce4535ee0', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '9D00', '1', false, 'REGIME_GERAL',
        '2026-02-05 09:30:00+00', '2026-02-05 09:30:00+00', '2026-02-05 09:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '990b0230-e1e6-42f7-8933-84fbd84d219f', '002f53d1-8c81-4b82-8762-8dc9ad36e756', 1, 'PRD-005', 'Computador Portátil HP ProBook', 11.0000, 450000.0000, 0.0000, 14.00, NULL, 5643000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e120b43b-b353-448a-9f11-a18c886372ee', '002f53d1-8c81-4b82-8762-8dc9ad36e756', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 20.0000, 4500.0000, 0.0000, 14.00, NULL, 102600.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'e6bb1b0c-8450-40b0-b3dd-cfb510771afd', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000003', 3, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Restaurante Marginal', '5415566778', 'Ilha de Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 3164300.0000, 441000.0000, 3605300.0000,
        0.0000, 0.0000, '08c8d83ddcb445af55a99854c37556ae54c6e3b372ff584833b8207cc7b34914', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '08C8', '1', false, 'REGIME_GERAL',
        '2026-02-14 15:10:00+00', '2026-02-14 15:10:00+00', '2026-02-14 15:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '95b4bc55-d8fc-4bec-a972-4d6039741d7c', 'e6bb1b0c-8450-40b0-b3dd-cfb510771afd', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 13.0000, 1100.0000, 0.0000, 0.00, 'M04', 14300.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '0690b04f-8bfa-4ff5-bb42-1cead55be2e1', 'e6bb1b0c-8450-40b0-b3dd-cfb510771afd', 2, 'PRD-005', 'Computador Portátil HP ProBook', 7.0000, 450000.0000, 0.0000, 14.00, NULL, 3591000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '8507d99d-9b5c-4459-a8e1-26ef1ec25de3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000004', 4, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Catoca Sociedade Mineira', '5409876543', 'Saurimo, Lunda Sul', 'Saurimo', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2100000.0000, 294000.0000, 2394000.0000,
        0.0000, 0.0000, 'cfd10ee69208dcf45ed3fa8173d07c02d5b95e2ec305ac1888a89bce3ff5fc86', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'CFD1', '1', false, 'REGIME_GERAL',
        '2026-02-20 11:50:00+00', '2026-02-20 11:50:00+00', '2026-02-20 11:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '3dcf381a-196b-46c9-9b97-f428ff3ed71a', '8507d99d-9b5c-4459-a8e1-26ef1ec25de3', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 14.0000, 150000.0000, 0.0000, 14.00, NULL, 2394000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '8338b556-7ac3-4523-9b37-1a5c1313e65d', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000004', 4, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Farmácia Popular Lda', '5416677880', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2025000.0000, 283500.0000, 2308500.0000,
        0.0000, 0.0000, '49807eab7e57893ca5b732d1095a7d7555f4b74a0690487d6872e99c54f1ced0', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '4980', '1', false, 'REGIME_GERAL',
        '2026-02-26 17:00:00+00', '2026-02-26 17:00:00+00', '2026-02-26 17:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '33dca18a-b85e-4a1e-a922-d32bbe6a8761', '8338b556-7ac3-4523-9b37-1a5c1313e65d', 1, 'PRD-005', 'Computador Portátil HP ProBook', 2.0000, 450000.0000, 0.0000, 14.00, NULL, 1026000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f4d90b8d-575f-41da-aea3-438e372e1dec', '8338b556-7ac3-4523-9b37-1a5c1313e65d', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 9.0000, 125000.0000, 0.0000, 14.00, NULL, 1282500.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'abaaf558-735e-4dd8-831c-8a6ce7d0e138', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000005', 5, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'ENSA Seguros de Angola', '5412345678', 'Largo 4 de Fevereiro, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 7650000.0000, 1071000.0000, 8721000.0000,
        0.0000, 0.0000, '529c7098647ad52d9eb218a1cd73e6feac2988fa7d91d75a091a34075946460a', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '529C', '1', false, 'REGIME_GERAL',
        '2026-03-04 10:00:00+00', '2026-03-04 10:00:00+00', '2026-03-04 10:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'b672d8ec-33cf-44e0-ae11-dc73ba24c41f', 'abaaf558-735e-4dd8-831c-8a6ce7d0e138', 1, 'PRD-005', 'Computador Portátil HP ProBook', 17.0000, 450000.0000, 0.0000, 14.00, NULL, 8721000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '1bbf403d-cd85-4b2d-b0f0-4a450ef56ea2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000005', 5, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Alimenta Angola Viana', '5417788992', 'Viana, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 900000.0000, 126000.0000, 1026000.0000,
        0.0000, 0.0000, '38513a460db9038136fdf0022df1a35e5f0ff60bef84339b8681339b6d4f0bc5', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '3851', '1', false, 'REGIME_GERAL',
        '2026-03-12 13:40:00+00', '2026-03-12 13:40:00+00', '2026-03-12 13:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '5cebbb57-b87d-40f6-a500-1f9d33afeb62', '1bbf403d-cd85-4b2d-b0f0-4a450ef56ea2', 1, 'PRD-006', 'Monitor LED 24 polegadas Dell', 6.0000, 125000.0000, 0.0000, 14.00, NULL, 855000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '99278707-2f29-4330-bcec-736ff3a5a1ff', '1bbf403d-cd85-4b2d-b0f0-4a450ef56ea2', 2, 'SRV-001', 'Consultoria e Suporte Técnico TI', 1.0000, 150000.0000, 0.0000, 14.00, NULL, 171000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'a981e02a-d840-419c-9d5e-f5a9afeb076b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000006', 6, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Angola Telecom E.P.', '5405556677', 'Rua Frederico Welwitsch, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3022500.0000, 423150.0000, 3445650.0000,
        0.0000, 0.0000, 'fe175d2313954678f39e225d445a6e4f9a210445133057b25e2814ce4180e088', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'FE17', '1', false, 'REGIME_GERAL',
        '2026-03-19 16:15:00+00', '2026-03-19 16:15:00+00', '2026-03-19 16:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '60aa2f4f-5c93-4ac3-becf-4ee5a54f9bc1', 'a981e02a-d840-419c-9d5e-f5a9afeb076b', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 20.0000, 150000.0000, 0.0000, 14.00, NULL, 3420000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd49dca4c-c93a-486e-83b2-f62467227608', 'a981e02a-d840-419c-9d5e-f5a9afeb076b', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'f0e2d15d-33c0-4b41-8ee4-de10366f392c', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000006', 6, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Padaria e Pastelaria Luanda', '5418899003', 'Ingombota, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 1755000.0000, 245700.0000, 2000700.0000,
        0.0000, 0.0000, 'ea404c9abf953c4efd2347c9e269e9085b4f901b510a0ad0606fa375ee3fa1c4', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'EA40', '1', false, 'REGIME_GERAL',
        '2026-03-27 12:25:00+00', '2026-03-27 12:25:00+00', '2026-03-27 12:25:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '103446b4-3ee9-4961-b776-0dc00ec97413', 'f0e2d15d-33c0-4b41-8ee4-de10366f392c', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 10.0000, 150000.0000, 0.0000, 14.00, NULL, 1710000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'db7c7934-a6f7-403b-9081-0bf2471da908', 'f0e2d15d-33c0-4b41-8ee4-de10366f392c', 2, 'SRV-002', 'Serviços de Manutenção e Rede', 3.0000, 85000.0000, 0.0000, 14.00, NULL, 290700.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'd3e893f0-6b90-42d0-b082-41f0fd5cada6', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000007', 7, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'TAAG Linhas Aéreas de Angola', '5401122334', 'Rua da Missão 123, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1350000.0000, 189000.0000, 1539000.0000,
        0.0000, 0.0000, '4b0f28c83ef3d32307f93658e08b9efd3e2ec08f6046fe52c5632f40e82b3b02', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '4B0F', '1', false, 'REGIME_GERAL',
        '2026-04-03 09:45:00+00', '2026-04-03 09:45:00+00', '2026-04-03 09:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '6b04f91a-c423-48c3-88a4-8e8b18d82bab', 'd3e893f0-6b90-42d0-b082-41f0fd5cada6', 1, 'PRD-005', 'Computador Portátil HP ProBook', 3.0000, 450000.0000, 0.0000, 14.00, NULL, 1539000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'a79547a6-1a2a-4acc-8e97-55b06579e5e7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000007', 7, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Clínica Girassol Lda', '5419900114', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 1212500.0000, 169750.0000, 1382250.0000,
        0.0000, 0.0000, 'da6e83a764a6c094a04b1a6d0b95b63f915c0970ff2d8915c3729e4ea92dedd3', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'DA6E', '1', false, 'REGIME_GERAL',
        '2026-04-11 14:15:00+00', '2026-04-11 14:15:00+00', '2026-04-11 14:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'b88929dd-e5aa-427f-9b12-af6f1edc0cc2', 'a79547a6-1a2a-4acc-8e97-55b06579e5e7', 1, 'SRV-002', 'Serviços de Manutenção e Rede', 14.0000, 85000.0000, 0.0000, 14.00, NULL, 1356600.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f0219efb-48fe-4467-b65c-a6a07c7de9be', 'a79547a6-1a2a-4acc-8e97-55b06579e5e7', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '6f0c0ead-51dc-4f63-9eff-f55780c59676', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000008', 8, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Porto de Luanda E.P.', '5409988776', 'Largo do Porto, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 900000.0000, 126000.0000, 1026000.0000,
        0.0000, 0.0000, '74375b0914876951f2306fe67b91ab86bb6756b5828d87c5fb86bf63ac3c9bc3', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '7437', '1', false, 'REGIME_GERAL',
        '2026-04-18 11:30:00+00', '2026-04-18 11:30:00+00', '2026-04-18 11:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'c713afa1-fba3-4322-9c98-5b855bf498da', '6f0c0ead-51dc-4f63-9eff-f55780c59676', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 6.0000, 150000.0000, 0.0000, 14.00, NULL, 1026000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '6a2c559d-4643-4b11-be88-cb370a9ae3cf', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000008', 8, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hotel Epic Sana Luanda', '5410011225', 'Rua da Missão, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 26450.0000, 3703.0000, 30153.0000,
        0.0000, 0.0000, 'b766a41071c065f8786fdeeb8d70f3fa4b77ab159f9846a3ae5590872470a35c', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'B766', '1', false, 'REGIME_GERAL',
        '2026-04-24 16:50:00+00', '2026-04-24 16:50:00+00', '2026-04-24 16:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '938e1bba-16df-4d3d-8b06-bd1dfd076393', '6a2c559d-4643-4b11-be88-cb370a9ae3cf', 1, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 3.0000, 4500.0000, 0.0000, 14.00, NULL, 15390.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '2ea20864-f83e-4b2b-b59b-701f124ac5ab', '6a2c559d-4643-4b11-be88-cb370a9ae3cf', 2, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 7.0000, 1850.0000, 0.0000, 14.00, NULL, 14763.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '6247318d-184c-40bd-afa8-e2ad0c9d51c8', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000009', 9, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Banco BFA S.A.', '5402233445', 'Rua Major Kanhangulo, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 4140000.0000, 579600.0000, 4719600.0000,
        0.0000, 0.0000, '25e0d40558e205b950d049f68448190829ab639e60de69e0ca7e57810cfdb58d', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '25E0', '1', false, 'REGIME_GERAL',
        '2026-05-06 10:20:00+00', '2026-05-06 10:20:00+00', '2026-05-06 10:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'dabb10e6-d7f5-4966-84d1-daa64fb0afb8', '6247318d-184c-40bd-afa8-e2ad0c9d51c8', 1, 'PRD-005', 'Computador Portátil HP ProBook', 9.0000, 450000.0000, 0.0000, 14.00, NULL, 4617000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '6455d297-734b-4e20-8345-018c113d2ebe', '6247318d-184c-40bd-afa8-e2ad0c9d51c8', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 20.0000, 4500.0000, 0.0000, 14.00, NULL, 102600.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'a5a7f6f6-6c07-4c2b-be19-1d8a2e6d7b9b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000009', 9, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Supermercado Candando', '5413344557', 'Talatona, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 21500.0000, 1813.0000, 23313.0000,
        0.0000, 0.0000, 'e7bb4948a2af27c47314928ed7c2e2fa37b5d0ab00154d4dbcbd1011de7b6aef', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'E7BB', '1', false, 'REGIME_GERAL',
        '2026-05-13 15:35:00+00', '2026-05-13 15:35:00+00', '2026-05-13 15:35:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '85181f17-9735-40f2-b0b0-f67868afd83d', 'a5a7f6f6-6c07-4c2b-be19-1d8a2e6d7b9b', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 7.0000, 1850.0000, 0.0000, 14.00, NULL, 14763.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '95cbf208-92f3-499d-b5e2-d6c52f0cb089', 'a5a7f6f6-6c07-4c2b-be19-1d8a2e6d7b9b', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 9.0000, 950.0000, 0.0000, 0.00, 'M04', 8550.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '1d948fc7-0d98-42b5-9d49-2183b04c4bad', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000010', 10, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Soba Store Angola Lda', '5416677889', 'Avenida Comandante Valódia, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1800000.0000, 252000.0000, 2052000.0000,
        0.0000, 0.0000, 'd046de61d64c40480d664ce2009a6fe1e86ac97a46b1dac73cd201907f37963a', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'D046', '1', false, 'REGIME_GERAL',
        '2026-05-21 11:10:00+00', '2026-05-21 11:10:00+00', '2026-05-21 11:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e29ef4ee-a9e5-43f8-9447-d6462df7f0de', '1d948fc7-0d98-42b5-9d49-2183b04c4bad', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 12.0000, 150000.0000, 0.0000, 14.00, NULL, 2052000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'df4d67e3-bec4-4ba5-bdc2-3365d718f3f2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000010', 10, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Distribuidora Viana Lda', '5414455668', 'Viana Park, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 11550.0000, 0.0000, 11550.0000,
        0.0000, 0.0000, 'dc0089bfef216d486e3dd8753343fa50ea3f8574a12721a216029e5ea5488b81', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'DC00', '1', false, 'REGIME_GERAL',
        '2026-05-28 17:15:00+00', '2026-05-28 17:15:00+00', '2026-05-28 17:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '59cabf87-3863-4e84-b19c-0629a7b71534', 'df4d67e3-bec4-4ba5-bdc2-3365d718f3f2', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 11.0000, 950.0000, 0.0000, 0.00, 'M04', 10450.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ef30c1e8-021c-4fb1-9ea6-72ca28590288', 'df4d67e3-bec4-4ba5-bdc2-3365d718f3f2', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 1.0000, 1100.0000, 0.0000, 0.00, 'M04', 1100.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '45e83c49-5d95-4469-8afc-1d6e520ff671', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000011', 11, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Multitel Serviços de Telecomunicações', '5413344556', 'Talatona Park, Edifício 2, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 6750000.0000, 945000.0000, 7695000.0000,
        0.0000, 0.0000, 'b9cbb84dccfc78d949d0323c4a0599ac56da52395481fec6f88224f2d6bf2929', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'B9CB', '1', false, 'REGIME_GERAL',
        '2026-06-04 09:15:00+00', '2026-06-04 09:15:00+00', '2026-06-04 09:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '08e8cef0-cd90-4eb9-b592-e0feadeae94a', '45e83c49-5d95-4469-8afc-1d6e520ff671', 1, 'PRD-005', 'Computador Portátil HP ProBook', 15.0000, 450000.0000, 0.0000, 14.00, NULL, 7695000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'c1cd4fa4-33e3-45a7-a722-75ac98e54bba', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000011', 11, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Papelaria Central Lda', '5415566779', 'Mutamba, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 1366500.0000, 189000.0000, 1555500.0000,
        0.0000, 0.0000, '70017742ab1cdfe7b7546873654c8ebe98298f6c6a57ae34b57acbf5d03c46ff', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '7001', '1', false, 'REGIME_GERAL',
        '2026-06-12 14:40:00+00', '2026-06-12 14:40:00+00', '2026-06-12 14:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '922614ce-de58-499c-bb18-aba767bd7cde', 'c1cd4fa4-33e3-45a7-a722-75ac98e54bba', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 15.0000, 1100.0000, 0.0000, 0.00, 'M04', 16500.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '1c8b41a0-a2a6-4de1-8f0c-b7983e37e913', 'c1cd4fa4-33e3-45a7-a722-75ac98e54bba', 2, 'PRD-005', 'Computador Portátil HP ProBook', 3.0000, 450000.0000, 0.0000, 14.00, NULL, 1539000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '6a05528a-9b34-49fa-9eb6-fef5015bbcd8', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000012', 12, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'TotalEnergies EP Angola', '5407788990', 'Avenida 4 de Fevereiro 140, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2722500.0000, 381150.0000, 3103650.0000,
        0.0000, 0.0000, 'abc8caf73df594c487a3f0e739bb8777178a5293e1db46b23c8aa1f633b1c4fa', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'ABC8', '1', false, 'REGIME_GERAL',
        '2026-06-19 11:25:00+00', '2026-06-19 11:25:00+00', '2026-06-19 11:25:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '2171ca38-580a-40f5-8f3a-aa802f9c6248', '6a05528a-9b34-49fa-9eb6-fef5015bbcd8', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 18.0000, 150000.0000, 0.0000, 14.00, NULL, 3078000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '8b468f17-8da3-4078-a920-eb8fe5f8d509', '6a05528a-9b34-49fa-9eb6-fef5015bbcd8', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '8744b671-6825-40e4-86cb-1f6d4a88d7f2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000012', 12, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Consumidor Final', '999999999', 'Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2425000.0000, 339500.0000, 2764500.0000,
        0.0000, 0.0000, 'a978e078b25b04863b85512d2c10c4222f4968664e7bed0961829526f68465c7', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'A978', '1', false, 'REGIME_GERAL',
        '2026-06-25 16:20:00+00', '2026-06-25 16:20:00+00', '2026-06-25 16:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f1fef417-7277-4974-922b-5bb4ced83417', '8744b671-6825-40e4-86cb-1f6d4a88d7f2', 1, 'PRD-005', 'Computador Portátil HP ProBook', 4.0000, 450000.0000, 0.0000, 14.00, NULL, 2052000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '42f4a6c6-0a81-4462-ac99-b3aff0cd74ea', '8744b671-6825-40e4-86cb-1f6d4a88d7f2', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 5.0000, 125000.0000, 0.0000, 14.00, NULL, 712500.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '71457a20-2cc5-44cb-93f3-9f2c94f012c0', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000013', 13, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Angola Cables S.A.', '5418899001', 'Talatona Central Park, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 9450000.0000, 1323000.0000, 10773000.0000,
        0.0000, 0.0000, 'da8685e44b439c2937b0d29c2d7fbcd7410d222f7bbf2a29b132fc9af96f2263', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'DA86', '1', false, 'REGIME_GERAL',
        '2026-07-03 10:30:00+00', '2026-07-03 10:30:00+00', '2026-07-03 10:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '342547b3-02d0-4ecf-87fb-9efc8460efdb', '71457a20-2cc5-44cb-93f3-9f2c94f012c0', 1, 'PRD-005', 'Computador Portátil HP ProBook', 21.0000, 450000.0000, 0.0000, 14.00, NULL, 10773000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'd916760b-ebff-4ee0-b187-648e4038c5da', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000013', 13, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hipermercado Kero', '5412233445', 'Nova Vida, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 2050000.0000, 287000.0000, 2337000.0000,
        0.0000, 0.0000, 'a737a74966673a0a1dd4484b6dabb336b509432c0dee37d86ff97bee363915b4', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'A737', '1', false, 'REGIME_GERAL',
        '2026-07-10 13:50:00+00', '2026-07-10 13:50:00+00', '2026-07-10 13:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '1fd2263d-f22a-425f-93ac-3cf728d87e54', 'd916760b-ebff-4ee0-b187-648e4038c5da', 1, 'PRD-006', 'Monitor LED 24 polegadas Dell', 8.0000, 125000.0000, 0.0000, 14.00, NULL, 1140000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '138744e9-b744-4790-a9dc-10ba635377be', 'd916760b-ebff-4ee0-b187-648e4038c5da', 2, 'SRV-001', 'Consultoria e Suporte Técnico TI', 7.0000, 150000.0000, 0.0000, 14.00, NULL, 1197000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'c52678b1-a19b-46fd-a711-4ea61ea2a6c2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000014', 14, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Secil Marítima S.A.', '5404455667', 'Terminal Marítimo de Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 600000.0000, 84000.0000, 684000.0000,
        0.0000, 0.0000, '1ec74d153726511b903b5c6a18d3342797ac4616e3dcb15b1abcac827cf284db', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '1EC7', '1', false, 'REGIME_GERAL',
        '2026-07-17 12:05:00+00', '2026-07-17 12:05:00+00', '2026-07-17 12:05:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ad548ec5-f3c0-44ec-9824-6360803bdb31', 'c52678b1-a19b-46fd-a711-4ea61ea2a6c2', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 4.0000, 150000.0000, 0.0000, 14.00, NULL, 684000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'ec57ce6c-9ae0-4d5a-9f50-2ccc09a79ad3', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000014', 14, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Restaurante Marginal', '5415566778', 'Ilha de Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2565000.0000, 359100.0000, 2924100.0000,
        0.0000, 0.0000, '47a73d3af6a1fee90424bbe15e2d766ef47519576d875fb251a2551c22fbce2d', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '47A7', '1', false, 'REGIME_GERAL',
        '2026-07-24 15:45:00+00', '2026-07-24 15:45:00+00', '2026-07-24 15:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'a7b9ec45-f672-4649-988a-5faa1ce97934', 'ec57ce6c-9ae0-4d5a-9f50-2ccc09a79ad3', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 12.0000, 150000.0000, 0.0000, 14.00, NULL, 2052000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '17f22959-482c-4543-9abf-b3d0073b249d', 'ec57ce6c-9ae0-4d5a-9f50-2ccc09a79ad3', 2, 'SRV-002', 'Serviços de Manutenção e Rede', 9.0000, 85000.0000, 0.0000, 14.00, NULL, 872100.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '6b9e355a-498f-4d52-ac1c-3eadfa58cb3a', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000015', 15, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Standard Bank Angola', '5411122334', 'Condomínio Belas Business Park, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3240000.0000, 453600.0000, 3693600.0000,
        0.0000, 0.0000, '985eac60fa1398a7d6c82ff289eb172ffdd199881ff3d40027ce5899e89de586', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '985E', '1', false, 'REGIME_GERAL',
        '2026-08-05 09:50:00+00', '2026-08-05 09:50:00+00', '2026-08-05 09:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '47171df9-c345-4176-b7c8-117cc00f6727', '6b9e355a-498f-4d52-ac1c-3eadfa58cb3a', 1, 'PRD-005', 'Computador Portátil HP ProBook', 7.0000, 450000.0000, 0.0000, 14.00, NULL, 3591000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '4b5e40d7-e21b-4ff9-abff-c69be4c21973', '6b9e355a-498f-4d52-ac1c-3eadfa58cb3a', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 20.0000, 4500.0000, 0.0000, 14.00, NULL, 102600.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '1a4a53c3-19f6-40f6-a038-554033484b1b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000015', 15, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Farmácia Popular Lda', '5416677880', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 89500.0000, 12530.0000, 102030.0000,
        0.0000, 0.0000, '23492c28f9b5bc9215b767bc18e8ea9f12fef97f66ea6c79e2ff164869f7b48a', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '2349', '1', false, 'REGIME_GERAL',
        '2026-08-13 14:20:00+00', '2026-08-13 14:20:00+00', '2026-08-13 14:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'b325c0d3-9f4c-438b-84c1-0ea826b2ef62', '1a4a53c3-19f6-40f6-a038-554033484b1b', 1, 'SRV-002', 'Serviços de Manutenção e Rede', 1.0000, 85000.0000, 0.0000, 14.00, NULL, 96900.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'bec6c625-726b-480e-99a5-b39f5a0c41c5', '1a4a53c3-19f6-40f6-a038-554033484b1b', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 1.0000, 4500.0000, 0.0000, 14.00, NULL, 5130.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '2651efb3-40c3-4745-b3e8-8287e3acf01b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000016', 16, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Nova Cimangola S.A.', '5403322114', 'Estrada de Cacuaco, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1500000.0000, 210000.0000, 1710000.0000,
        0.0000, 0.0000, '5e12adc3d606d57700bfcb1d1c9e47d266f599b11b71fb52448c6cb50bc79dba', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '5E12', '1', false, 'REGIME_GERAL',
        '2026-08-20 11:40:00+00', '2026-08-20 11:40:00+00', '2026-08-20 11:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '41a110fb-5089-4ffe-ab5f-c3776119e3ad', '2651efb3-40c3-4745-b3e8-8287e3acf01b', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 10.0000, 150000.0000, 0.0000, 14.00, NULL, 1710000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '46c804f7-3fd6-44a6-9e53-b92677079fcb', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000016', 16, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Alimenta Angola Viana', '5417788992', 'Viana, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 28050.0000, 3927.0000, 31977.0000,
        0.0000, 0.0000, '10fbfab1e196c104e94537ae6f7fab2ebd560641fb8f2d83c494d1b43e39a364', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '10FB', '1', false, 'REGIME_GERAL',
        '2026-08-27 16:35:00+00', '2026-08-27 16:35:00+00', '2026-08-27 16:35:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '89a052d7-12d7-4271-951f-203c0aff6c28', '46c804f7-3fd6-44a6-9e53-b92677079fcb', 1, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '0610fc00-a794-4a54-864c-19e32f90c6ca', '46c804f7-3fd6-44a6-9e53-b92677079fcb', 2, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 3.0000, 1850.0000, 0.0000, 14.00, NULL, 6327.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '09ecaea6-15e1-417d-af19-3b7583c5c74d', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000017', 17, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Africell Angola S.A.', '5419900112', 'Edifício Kings Tower, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 5850000.0000, 819000.0000, 6669000.0000,
        0.0000, 0.0000, 'f5ad13fb7d7d1695d7b45ff98f1d1e5d85928dc417bb043680d6bd312f862035', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'F5AD', '1', false, 'REGIME_GERAL',
        '2026-09-03 10:10:00+00', '2026-09-03 10:10:00+00', '2026-09-03 10:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd20e0fd9-4d63-4832-a576-bd325ec217a4', '09ecaea6-15e1-417d-af19-3b7583c5c74d', 1, 'PRD-005', 'Computador Portátil HP ProBook', 13.0000, 450000.0000, 0.0000, 14.00, NULL, 6669000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'a2bacc54-63fc-485e-ba37-123e2fe234cc', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000017', 17, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Padaria e Pastelaria Luanda', '5418899003', 'Ingombota, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 21400.0000, 2331.0000, 23731.0000,
        0.0000, 0.0000, 'f25f4b9884ac9b253df90c49e0b64dcc556cfd04b0a0999ef701e9e948b54158', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'F25F', '1', false, 'REGIME_GERAL',
        '2026-09-11 15:05:00+00', '2026-09-11 15:05:00+00', '2026-09-11 15:05:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '719866e3-aaf8-4f54-9f87-d30f0790ae58', 'a2bacc54-63fc-485e-ba37-123e2fe234cc', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 9.0000, 1850.0000, 0.0000, 14.00, NULL, 18981.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'a70ddc71-6244-4f82-9c06-3596bcf5b075', 'a2bacc54-63fc-485e-ba37-123e2fe234cc', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 5.0000, 950.0000, 0.0000, 0.00, 'M04', 4750.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'fbfb0960-ac7d-4e65-8dc3-7c2584941f01', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000018', 18, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Pumangol Lda', '5406655443', 'Zona Industrial de Viana, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2422500.0000, 339150.0000, 2761650.0000,
        0.0000, 0.0000, '2695ab883f2a1c872ec8b6f360b4a4cbd62f01281faa991a08bb9e2fe5e025c1', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '2695', '1', false, 'REGIME_GERAL',
        '2026-09-18 11:15:00+00', '2026-09-18 11:15:00+00', '2026-09-18 11:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd390017d-9047-4ec3-b7a5-d76d01e324d3', 'fbfb0960-ac7d-4e65-8dc3-7c2584941f01', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 16.0000, 150000.0000, 0.0000, 14.00, NULL, 2736000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '8436a6f1-0daa-46c7-8d17-f9c357f2d6ec', 'fbfb0960-ac7d-4e65-8dc3-7c2584941f01', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '6fb3ff47-3c63-429d-9131-e879b8330ce7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000018', 18, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Clínica Girassol Lda', '5419900114', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 20050.0000, 0.0000, 20050.0000,
        0.0000, 0.0000, '694d14fc4c8adeceaa7f99e3bd453a2891b23ac1fb83d60d6c9ef90e3f97b4d3', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '694D', '1', false, 'REGIME_GERAL',
        '2026-09-25 17:00:00+00', '2026-09-25 17:00:00+00', '2026-09-25 17:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '19ddc542-80eb-4fd9-a46d-ef7acb1e4509', '6fb3ff47-3c63-429d-9131-e879b8330ce7', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 13.0000, 950.0000, 0.0000, 0.00, 'M04', 12350.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ad566bc9-f8a3-49c2-af38-7f79006d03ad', '6fb3ff47-3c63-429d-9131-e879b8330ce7', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 7.0000, 1100.0000, 0.0000, 0.00, 'M04', 7700.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'e7df827a-68f1-4234-a571-f329d6ffcc62', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000019', 19, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Refriango Indústria Lda', '5408877665', 'Complexo Industrial do Kikuxi, Viana', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 8550000.0000, 1197000.0000, 9747000.0000,
        0.0000, 0.0000, '862a00e5606adcecd043c1950cb170002c7a080828fd8a097b6603e39188f6c0', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '862A', '1', false, 'REGIME_GERAL',
        '2026-10-02 09:30:00+00', '2026-10-02 09:30:00+00', '2026-10-02 09:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '377d3766-6823-4b1c-8d5b-ad5491999ff9', 'e7df827a-68f1-4234-a571-f329d6ffcc62', 1, 'PRD-005', 'Computador Portátil HP ProBook', 19.0000, 450000.0000, 0.0000, 14.00, NULL, 9747000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'bfee5ec3-2b4b-4fa7-afba-85434409f74b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000019', 19, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hotel Epic Sana Luanda', '5410011225', 'Rua da Missão, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 4052200.0000, 567000.0000, 4619200.0000,
        0.0000, 0.0000, '52b65b9e82a876b4c09ddb8e84f712fc174672777b6289bc36823df348411193', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '52B6', '1', false, 'REGIME_GERAL',
        '2026-10-05 14:10:00+00', '2026-10-05 14:10:00+00', '2026-10-05 14:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '4db53947-4e57-4bea-b6ed-4445aab85e1c', 'bfee5ec3-2b4b-4fa7-afba-85434409f74b', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 2.0000, 1100.0000, 0.0000, 0.00, 'M04', 2200.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'b2df554e-4a51-4557-9422-16846bd303d7', 'bfee5ec3-2b4b-4fa7-afba-85434409f74b', 2, 'PRD-005', 'Computador Portátil HP ProBook', 9.0000, 450000.0000, 0.0000, 14.00, NULL, 4617000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'f1eabac4-78bf-4041-b026-57ba926e6360', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000020', 20, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Grupo Castel Angola Lda', '5402211334', 'Estrada de Catete km 14, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 300000.0000, 42000.0000, 342000.0000,
        0.0000, 0.0000, '36fb8ad40340a9e2d91b3cf9f893e94feccc1f896d932e414d8b19272d682615', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '36FB', '1', false, 'REGIME_GERAL',
        '2026-10-09 11:45:00+00', '2026-10-09 11:45:00+00', '2026-10-09 11:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '13560209-aa69-43f0-92fe-e1abe9d17807', 'f1eabac4-78bf-4041-b026-57ba926e6360', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 2.0000, 150000.0000, 0.0000, 14.00, NULL, 342000.0000
        );
        

    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        'f46809a8-d586-4a6a-bf67-a6e473754487', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000020', 20, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Supermercado Candando', '5413344557', 'Talatona, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2825000.0000, 395500.0000, 3220500.0000,
        0.0000, 0.0000, '7a5851103731a5574fc65f78becdacb3e62f4bd6dfd13802ccc1e72080d0f7e1', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '7A58', '1', false, 'REGIME_GERAL',
        '2026-10-12 16:25:00+00', '2026-10-12 16:25:00+00', '2026-10-12 16:25:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '277328a5-5d8c-4d86-bbb0-613dfe843f59', 'f46809a8-d586-4a6a-bf67-a6e473754487', 1, 'PRD-005', 'Computador Portátil HP ProBook', 6.0000, 450000.0000, 0.0000, 14.00, NULL, 3078000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '4e075e2b-5506-48dc-8a87-ce4fc156a31f', 'f46809a8-d586-4a6a-bf67-a6e473754487', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 1.0000, 125000.0000, 0.0000, 14.00, NULL, 142500.0000
        );
        
COMMIT;