BEGIN;

DELETE FROM kudiba_core.invoice_lines WHERE invoice_id IN (
    SELECT id FROM kudiba_core.invoices WHERE series_id IN ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002')
);
DELETE FROM kudiba_core.invoices WHERE series_id IN ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');


    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '84e27464-6500-4d04-8f59-f3782c7cd1f2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000001', 1, 'FT',
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
            'ee17b9c0-78ee-46bb-a477-a9b82c42b95f', '84e27464-6500-4d04-8f59-f3782c7cd1f2', 1, 'PRD-005', 'Computador Portátil HP ProBook', 5.0000, 450000.0000, 0.0000, 14.00, NULL, 2565000.0000
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
        '737a5ce5-c4c6-45d3-b891-009535fa848d', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000001', 1, 'FR',
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
            'd15b609a-1d05-4fe1-a892-4db7066be73a', '737a5ce5-c4c6-45d3-b891-009535fa848d', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 5.0000, 1850.0000, 0.0000, 14.00, NULL, 10545.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ee718ce1-e8c8-4881-844a-1b90b1110ea7', '737a5ce5-c4c6-45d3-b891-009535fa848d', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 3.0000, 950.0000, 0.0000, 0.00, 'M04', 2850.0000
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
        '541a2dd6-b19e-4335-aacd-44efbf3ad733', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000002', 2, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Banco BAI S.A.', '5401234567', 'Avenida Lenine 35, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1267500.0000, 177450.0000, 1444950.0000,
        0.0000, 0.0000, '149d190b1f098970f190cfacf968f5383d6f57469e02ed3d9f5c7b3c43182be9', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '149D', '1', false, 'REGIME_GERAL',
        '2026-01-24 11:20:00+00', '2026-01-24 11:20:00+00', '2026-01-24 11:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '9cd657ec-862f-4156-8095-abefee5cf095', '541a2dd6-b19e-4335-aacd-44efbf3ad733', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 8.0000, 150000.0000, 0.0000, 14.00, NULL, 1368000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'cd50e0ca-4a9c-4b89-90e7-c597e13f8a66', '541a2dd6-b19e-4335-aacd-44efbf3ad733', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 15.0000, 4500.0000, 0.0000, 14.00, NULL, 76950.0000
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
        '8b0e71f7-7986-42b6-ada6-09c8b438c760', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000002', 2, 'FR',
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
            '9a3c92a1-139f-4fb0-b926-0e487e2eb6d9', '8b0e71f7-7986-42b6-ada6-09c8b438c760', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 9.0000, 950.0000, 0.0000, 0.00, 'M04', 8550.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '081411c0-19e5-4e5b-a32c-deb0b87074ea', '8b0e71f7-7986-42b6-ada6-09c8b438c760', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 5.0000, 1100.0000, 0.0000, 0.00, 'M04', 5500.0000
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
        'ca113803-13dc-4825-967a-a3a9cdb9926c', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000003', 3, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Sonangol Distribuidora E.P.', '5400012345', 'Rua Rainha Ginga 29, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 4950000.0000, 693000.0000, 5643000.0000,
        0.0000, 0.0000, '5102b6153b2ddcd81df869b298540dfbe2e3914cae350d771492918991706a90', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '5102', '1', false, 'REGIME_GERAL',
        '2026-02-05 09:30:00+00', '2026-02-05 09:30:00+00', '2026-02-05 09:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '902a74cd-d10f-4a84-81f8-ab0f3efd41e3', 'ca113803-13dc-4825-967a-a3a9cdb9926c', 1, 'PRD-005', 'Computador Portátil HP ProBook', 11.0000, 450000.0000, 0.0000, 14.00, NULL, 5643000.0000
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
        '64bd20c9-cc0f-40a2-b6e9-bf78f5a6fe0d', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000003', 3, 'FR',
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
            'e423e475-ae01-4a23-9cdd-276ddb6adb80', '64bd20c9-cc0f-40a2-b6e9-bf78f5a6fe0d', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 13.0000, 1100.0000, 0.0000, 0.00, 'M04', 14300.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f66ee515-d4de-4bba-86b1-5cb2bc707203', '64bd20c9-cc0f-40a2-b6e9-bf78f5a6fe0d', 2, 'PRD-005', 'Computador Portátil HP ProBook', 7.0000, 450000.0000, 0.0000, 14.00, NULL, 3591000.0000
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
        'b609f6f5-e9ad-451d-a2f1-0cb27d62a5fa', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000004', 4, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Catoca Sociedade Mineira', '5409876543', 'Saurimo, Lunda Sul', 'Saurimo', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2212500.0000, 309750.0000, 2522250.0000,
        0.0000, 0.0000, '09974ef0e75121e484fe029a4fc28da7be7d717fd42f0c24cf0eff0f6d30f5b9', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '0997', '1', false, 'REGIME_GERAL',
        '2026-02-20 11:50:00+00', '2026-02-20 11:50:00+00', '2026-02-20 11:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '94dc1565-48f7-4ca5-9978-4b82ab7b8be1', 'b609f6f5-e9ad-451d-a2f1-0cb27d62a5fa', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 14.0000, 150000.0000, 0.0000, 14.00, NULL, 2394000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '660a8cf7-ed8b-4949-855a-0a745de30dd5', 'b609f6f5-e9ad-451d-a2f1-0cb27d62a5fa', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 25.0000, 4500.0000, 0.0000, 14.00, NULL, 128250.0000
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
        '3dffa43c-c506-46ac-86e7-ac3e2361b6c5', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000004', 4, 'FR',
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
            'b3ddea23-8ca0-4236-9cc3-6dd039f6e2c3', '3dffa43c-c506-46ac-86e7-ac3e2361b6c5', 1, 'PRD-005', 'Computador Portátil HP ProBook', 2.0000, 450000.0000, 0.0000, 14.00, NULL, 1026000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '99e12178-f9fe-429a-ad23-31650caf1992', '3dffa43c-c506-46ac-86e7-ac3e2361b6c5', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 9.0000, 125000.0000, 0.0000, 14.00, NULL, 1282500.0000
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
        '57515db1-f326-4925-bd40-249a24d31773', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000005', 5, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'ENSA Seguros de Angola', '5412345678', 'Largo 4 de Fevereiro, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 7650000.0000, 1071000.0000, 8721000.0000,
        0.0000, 0.0000, 'd529e779c1c5c0c7c58495097713b5089c3aff7006d287be20d899e3471aca92', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'D529', '1', false, 'REGIME_GERAL',
        '2026-03-04 10:00:00+00', '2026-03-04 10:00:00+00', '2026-03-04 10:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ca204721-2693-4c78-9a38-96c2394d380d', '57515db1-f326-4925-bd40-249a24d31773', 1, 'PRD-005', 'Computador Portátil HP ProBook', 17.0000, 450000.0000, 0.0000, 14.00, NULL, 8721000.0000
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
        'c1c38c9b-b0b9-4baf-ac52-58cc4ff91a3a', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000005', 5, 'FR',
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
            'a0a28ae0-af88-432e-b270-2a4c21a87017', 'c1c38c9b-b0b9-4baf-ac52-58cc4ff91a3a', 1, 'PRD-006', 'Monitor LED 24 polegadas Dell', 6.0000, 125000.0000, 0.0000, 14.00, NULL, 855000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '7012cd02-bb1d-418c-846d-bee8d1e6c871', 'c1c38c9b-b0b9-4baf-ac52-58cc4ff91a3a', 2, 'SRV-001', 'Consultoria e Suporte Técnico TI', 1.0000, 150000.0000, 0.0000, 14.00, NULL, 171000.0000
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
        '559dba58-adbe-45e7-b3c1-318297e5ca74', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000006', 6, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Angola Telecom E.P.', '5405556677', 'Rua Frederico Welwitsch, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3157500.0000, 442050.0000, 3599550.0000,
        0.0000, 0.0000, 'daa43e457f8fab8ec41d64fc45b694f0b2c4e69664c8c346468338eb066cbf31', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'DAA4', '1', false, 'REGIME_GERAL',
        '2026-03-19 16:15:00+00', '2026-03-19 16:15:00+00', '2026-03-19 16:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '37948fcd-cfbd-4d80-83af-7814284f4b93', '559dba58-adbe-45e7-b3c1-318297e5ca74', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 20.0000, 150000.0000, 0.0000, 14.00, NULL, 3420000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '37b2f832-f9f2-4826-82e4-21eb3bad0334', '559dba58-adbe-45e7-b3c1-318297e5ca74', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 35.0000, 4500.0000, 0.0000, 14.00, NULL, 179550.0000
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
        '6cdaf153-ca8b-4ede-b9a3-198d08cfac99', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000006', 6, 'FR',
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
            'c52f0920-15e7-4f2e-b739-b366831aae38', '6cdaf153-ca8b-4ede-b9a3-198d08cfac99', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 10.0000, 150000.0000, 0.0000, 14.00, NULL, 1710000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'c559e4e1-b75b-4dee-8b20-cdcc6c5f9813', '6cdaf153-ca8b-4ede-b9a3-198d08cfac99', 2, 'SRV-002', 'Serviços de Manutenção e Rede', 3.0000, 85000.0000, 0.0000, 14.00, NULL, 290700.0000
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
        '7c41a7fb-d840-4045-bf85-242695a3b5ca', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000007', 7, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'TAAG Linhas Aéreas de Angola', '5401122334', 'Rua da Missão 123, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 10350000.0000, 1449000.0000, 11799000.0000,
        0.0000, 0.0000, 'cd6a8f6e879582f46a31da61f758e99a02d43e2cfe8c3f2dfe5118f4163f7452', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'CD6A', '1', false, 'REGIME_GERAL',
        '2026-04-03 09:45:00+00', '2026-04-03 09:45:00+00', '2026-04-03 09:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ed5419ad-8d7f-4237-a612-c96bad9f9574', '7c41a7fb-d840-4045-bf85-242695a3b5ca', 1, 'PRD-005', 'Computador Portátil HP ProBook', 23.0000, 450000.0000, 0.0000, 14.00, NULL, 11799000.0000
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
        '043d9ba6-5766-49f9-9b86-c9dc4629aa85', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000007', 7, 'FR',
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
            '55641e91-6164-446b-a669-8ed5f3be2eed', '043d9ba6-5766-49f9-9b86-c9dc4629aa85', 1, 'SRV-002', 'Serviços de Manutenção e Rede', 14.0000, 85000.0000, 0.0000, 14.00, NULL, 1356600.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'eeef646e-2265-4e29-ae73-62ff8329ef27', '043d9ba6-5766-49f9-9b86-c9dc4629aa85', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
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
        'cbb3d912-5b68-4ce0-b836-b3eee178fc8b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000008', 8, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Porto de Luanda E.P.', '5409988776', 'Largo do Porto, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3922500.0000, 549150.0000, 4471650.0000,
        0.0000, 0.0000, '66608f5f0088f5d9e9e51e4df311632159db88486db33af97390eb82716cbf82', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '6660', '1', false, 'REGIME_GERAL',
        '2026-04-18 11:30:00+00', '2026-04-18 11:30:00+00', '2026-04-18 11:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '64d6e9b2-82fd-4c0e-ba8b-4e513a13b7e2', 'cbb3d912-5b68-4ce0-b836-b3eee178fc8b', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 26.0000, 150000.0000, 0.0000, 14.00, NULL, 4446000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '33909612-3f58-4cdb-81b3-13d2f4c4ccf5', 'cbb3d912-5b68-4ce0-b836-b3eee178fc8b', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
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
        'aac0f29a-4ddc-4656-a800-f2da4497f40f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000008', 8, 'FR',
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
            '227996e2-6acd-4b74-8b49-7ad26b82fffe', 'aac0f29a-4ddc-4656-a800-f2da4497f40f', 1, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 3.0000, 4500.0000, 0.0000, 14.00, NULL, 15390.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '4de8aab8-0681-4d0c-88b9-54d90e1ed97d', 'aac0f29a-4ddc-4656-a800-f2da4497f40f', 2, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 7.0000, 1850.0000, 0.0000, 14.00, NULL, 14763.0000
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
        'd485c472-dce1-4a88-b5ad-d6a25e2d0ec8', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000009', 9, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Banco BFA S.A.', '5402233445', 'Rua Major Kanhangulo, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1800000.0000, 252000.0000, 2052000.0000,
        0.0000, 0.0000, 'deba223b2d38f178eb9015a72b30c6aa66f971d2a94b16cd38b6b9bfe1de1efa', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'DEBA', '1', false, 'REGIME_GERAL',
        '2026-05-04 09:20:00+00', '2026-05-04 09:20:00+00', '2026-05-04 09:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '059f1661-f1dc-4a5d-9b80-4570939770c1', 'd485c472-dce1-4a88-b5ad-d6a25e2d0ec8', 1, 'PRD-005', 'Computador Portátil HP ProBook', 4.0000, 450000.0000, 0.0000, 14.00, NULL, 2052000.0000
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
        '7eb08b10-d6de-4cf2-ac6a-5298ae3845f9', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000009', 9, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Supermercado Candando', '5413344557', 'Talatona, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 21500.0000, 1813.0000, 23313.0000,
        0.0000, 0.0000, '3232fee550929fae0a3b0f31245268923c4c848f91c98d7e76d0f8f50c042119', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '3232', '1', false, 'REGIME_GERAL',
        '2026-05-09 14:15:00+00', '2026-05-09 14:15:00+00', '2026-05-09 14:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '5ca4b0a0-698d-49bd-9638-785d5c7211e5', '7eb08b10-d6de-4cf2-ac6a-5298ae3845f9', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 7.0000, 1850.0000, 0.0000, 14.00, NULL, 14763.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'fb1d4e40-c3f3-4b49-a86b-59c3bab07a00', '7eb08b10-d6de-4cf2-ac6a-5298ae3845f9', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 9.0000, 950.0000, 0.0000, 0.00, 'M04', 8550.0000
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
        '21992f4b-8663-4e00-891c-87ce6ccdda95', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000010', 10, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Soba Store Angola Lda', '5416677889', 'Avenida Comandante Valódia, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1117500.0000, 156450.0000, 1273950.0000,
        0.0000, 0.0000, 'aed778762cdad8e113d3c6e650fa493315da84f857b61c1426f18363aeda0276', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'AED7', '1', false, 'REGIME_GERAL',
        '2026-05-15 11:00:00+00', '2026-05-15 11:00:00+00', '2026-05-15 11:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd4687d39-792c-44fe-b4dd-a3b5db95d30c', '21992f4b-8663-4e00-891c-87ce6ccdda95', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 7.0000, 150000.0000, 0.0000, 14.00, NULL, 1197000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '2c2adb2f-e256-4c45-9e58-b1ba8ec70a5b', '21992f4b-8663-4e00-891c-87ce6ccdda95', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 15.0000, 4500.0000, 0.0000, 14.00, NULL, 76950.0000
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
        'f555188e-311a-4bd9-aacc-5cb2c05b551c', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000010', 10, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Distribuidora Viana Lda', '5414455668', 'Viana Park, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 11550.0000, 0.0000, 11550.0000,
        0.0000, 0.0000, 'd6d0a5a06312048615b091388388b593dec359f4bad74e5dc6d2095a06569863', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'D6D0', '1', false, 'REGIME_GERAL',
        '2026-05-20 16:30:00+00', '2026-05-20 16:30:00+00', '2026-05-20 16:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '623793b0-6846-4608-bd41-41a509fc6c4a', 'f555188e-311a-4bd9-aacc-5cb2c05b551c', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 11.0000, 950.0000, 0.0000, 0.00, 'M04', 10450.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ce3ec225-29a8-48dc-98e0-9b0ce872ae8b', 'f555188e-311a-4bd9-aacc-5cb2c05b551c', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 1.0000, 1100.0000, 0.0000, 0.00, 'M04', 1100.0000
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
        'a1acc981-6b15-4e98-8a73-f05120c187b4', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000011', 11, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Multitel Serviços de Telecomunicações', '5413344556', 'Talatona Park, Edifício 2, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 4500000.0000, 630000.0000, 5130000.0000,
        0.0000, 0.0000, 'a3747f9d15cea95da13015d84724244229a2f7221f570e525d1da55748e7a179', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'A374', '1', false, 'REGIME_GERAL',
        '2026-05-26 10:45:00+00', '2026-05-26 10:45:00+00', '2026-05-26 10:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '7640e302-f476-49ba-ae9c-838ed2248ec0', 'a1acc981-6b15-4e98-8a73-f05120c187b4', 1, 'PRD-005', 'Computador Portátil HP ProBook', 10.0000, 450000.0000, 0.0000, 14.00, NULL, 5130000.0000
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
        '2dfb8dbe-76cf-4b2b-aad0-bbcc93beabca', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000011', 11, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Papelaria Central Lda', '5415566779', 'Mutamba, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 1366500.0000, 189000.0000, 1555500.0000,
        0.0000, 0.0000, '710018bebb3c6420473faea68cf68a75c1564902402fafa9b36a2637adddef3e', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '7100', '1', false, 'REGIME_GERAL',
        '2026-05-30 15:20:00+00', '2026-05-30 15:20:00+00', '2026-05-30 15:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '5fa31812-f596-444a-8221-678eab24e495', '2dfb8dbe-76cf-4b2b-aad0-bbcc93beabca', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 15.0000, 1100.0000, 0.0000, 0.00, 'M04', 16500.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'a8fcf586-c728-427d-b86d-38ffafe4e285', '2dfb8dbe-76cf-4b2b-aad0-bbcc93beabca', 2, 'PRD-005', 'Computador Portátil HP ProBook', 3.0000, 450000.0000, 0.0000, 14.00, NULL, 1539000.0000
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
        'fa8b57f3-5f92-4711-9269-c29b9079f9a7', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000012', 12, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'TotalEnergies EP Angola', '5407788990', 'Avenida 4 de Fevereiro 140, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2062500.0000, 288750.0000, 2351250.0000,
        0.0000, 0.0000, '186c3d12ca7b3907b1f9713fdf931c50b9ee0c376ef7ca8f956e3dad62f42412', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '186C', '1', false, 'REGIME_GERAL',
        '2026-06-03 10:10:00+00', '2026-06-03 10:10:00+00', '2026-06-03 10:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '1eb56294-b335-469c-b9da-6c692e7d2737', 'fa8b57f3-5f92-4711-9269-c29b9079f9a7', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 13.0000, 150000.0000, 0.0000, 14.00, NULL, 2223000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '51c0ff41-5733-4134-8821-1ff6b52a5473', 'fa8b57f3-5f92-4711-9269-c29b9079f9a7', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 25.0000, 4500.0000, 0.0000, 14.00, NULL, 128250.0000
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
        '78346ac3-d33f-4a11-b306-2fce00a78c11', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000012', 12, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Consumidor Final', '999999999', 'Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2425000.0000, 339500.0000, 2764500.0000,
        0.0000, 0.0000, '1f6ea5d22380aee1a6ebc0789adfbede4c05b169305c6eeb6c9f0becbbf7475e', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '1F6E', '1', false, 'REGIME_GERAL',
        '2026-06-08 14:50:00+00', '2026-06-08 14:50:00+00', '2026-06-08 14:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '065fbb50-7e09-4e57-978f-f59fefcd88d3', '78346ac3-d33f-4a11-b306-2fce00a78c11', 1, 'PRD-005', 'Computador Portátil HP ProBook', 4.0000, 450000.0000, 0.0000, 14.00, NULL, 2052000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'cd576134-7fad-496a-8df2-b1995b0793bb', '78346ac3-d33f-4a11-b306-2fce00a78c11', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 5.0000, 125000.0000, 0.0000, 14.00, NULL, 712500.0000
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
        '26aca03c-c72f-4f94-943c-3e2e767a135f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000013', 13, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Angola Cables S.A.', '5418899001', 'Talatona Central Park, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 7200000.0000, 1008000.0000, 8208000.0000,
        0.0000, 0.0000, 'bfd7ebc4f344e5f8d71bb0153661b7cade031853d65c382a4cd7860c7bc9c34c', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'BFD7', '1', false, 'REGIME_GERAL',
        '2026-06-14 11:35:00+00', '2026-06-14 11:35:00+00', '2026-06-14 11:35:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '92acea1f-2766-42d5-bcbe-80e08692e577', '26aca03c-c72f-4f94-943c-3e2e767a135f', 1, 'PRD-005', 'Computador Portátil HP ProBook', 16.0000, 450000.0000, 0.0000, 14.00, NULL, 8208000.0000
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
        '7296146e-5556-4751-9f39-8470a9ee7b42', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000013', 13, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hipermercado Kero', '5412233445', 'Nova Vida, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 2050000.0000, 287000.0000, 2337000.0000,
        0.0000, 0.0000, '3c42cde612753fedec40466b39d41fa640072dfc174e1ac0420617a810afb0e2', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '3C42', '1', false, 'REGIME_GERAL',
        '2026-06-18 16:00:00+00', '2026-06-18 16:00:00+00', '2026-06-18 16:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '15c429a4-972d-4736-b6dc-ce3363ad223e', '7296146e-5556-4751-9f39-8470a9ee7b42', 1, 'PRD-006', 'Monitor LED 24 polegadas Dell', 8.0000, 125000.0000, 0.0000, 14.00, NULL, 1140000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '9ca5cc6c-d00e-45d1-b0b9-3967be3abecc', '7296146e-5556-4751-9f39-8470a9ee7b42', 2, 'SRV-001', 'Consultoria e Suporte Técnico TI', 7.0000, 150000.0000, 0.0000, 14.00, NULL, 1197000.0000
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
        'cd1c2c0f-d66d-4c4d-97e6-31518be8602b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000014', 14, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Secil Marítima S.A.', '5404455667', 'Terminal Marítimo de Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3007500.0000, 421050.0000, 3428550.0000,
        0.0000, 0.0000, 'b9b4abe516dea2d2d6a44b9747170170460a944cfce1c5aaff9940311349c301', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'B9B4', '1', false, 'REGIME_GERAL',
        '2026-06-23 09:40:00+00', '2026-06-23 09:40:00+00', '2026-06-23 09:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '16b3fcbe-8458-4495-b02c-9686a007821e', 'cd1c2c0f-d66d-4c4d-97e6-31518be8602b', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 19.0000, 150000.0000, 0.0000, 14.00, NULL, 3249000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '54143e9d-1184-40e8-a526-eb75346af56a', 'cd1c2c0f-d66d-4c4d-97e6-31518be8602b', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 35.0000, 4500.0000, 0.0000, 14.00, NULL, 179550.0000
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
        'e002e26e-19f2-41bf-881b-cb1f8597756a', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000014', 14, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Restaurante Marginal', '5415566778', 'Ilha de Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2565000.0000, 359100.0000, 2924100.0000,
        0.0000, 0.0000, '3c226fae67b58ad6584ca06f1f33c5b9fa9415127e85504d805081f22e6cf732', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '3C22', '1', false, 'REGIME_GERAL',
        '2026-06-29 17:15:00+00', '2026-06-29 17:15:00+00', '2026-06-29 17:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '5876780c-46ae-41c1-a88d-b6d6f8213545', 'e002e26e-19f2-41bf-881b-cb1f8597756a', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 12.0000, 150000.0000, 0.0000, 14.00, NULL, 2052000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '198efedb-cbd6-4888-a74c-91150b745b90', 'e002e26e-19f2-41bf-881b-cb1f8597756a', 2, 'SRV-002', 'Serviços de Manutenção e Rede', 9.0000, 85000.0000, 0.0000, 14.00, NULL, 872100.0000
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
        'eef37aaf-38a8-4735-b113-6988d5fc6ae9', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000015', 15, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Standard Bank Angola', '5411122334', 'Condomínio Belas Business Park, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 9900000.0000, 1386000.0000, 11286000.0000,
        0.0000, 0.0000, '1b91f963f8f1493c7b0dbcf0c18cea7e965d3c0c5138f75bdde7735af814d5ab', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '1B91', '1', false, 'REGIME_GERAL',
        '2026-07-02 09:15:00+00', '2026-07-02 09:15:00+00', '2026-07-02 09:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '1953069c-bb5b-4150-8a9e-4c9b353450ad', 'eef37aaf-38a8-4735-b113-6988d5fc6ae9', 1, 'PRD-005', 'Computador Portátil HP ProBook', 22.0000, 450000.0000, 0.0000, 14.00, NULL, 11286000.0000
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
        '28df00cb-88a9-4135-ad36-f0249621ed0d', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000015', 15, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Farmácia Popular Lda', '5416677880', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 89500.0000, 12530.0000, 102030.0000,
        0.0000, 0.0000, '688f49fdba4987220184deb944af0fa330753b118763e6d76b5e8fcd4bcd6b07', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '688F', '1', false, 'REGIME_GERAL',
        '2026-07-07 13:45:00+00', '2026-07-07 13:45:00+00', '2026-07-07 13:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'a2cfae54-19c1-4666-b847-8a064ecfdbf4', '28df00cb-88a9-4135-ad36-f0249621ed0d', 1, 'SRV-002', 'Serviços de Manutenção e Rede', 1.0000, 85000.0000, 0.0000, 14.00, NULL, 96900.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '581b5580-d0e0-4c6d-bc64-55eb829a599f', '28df00cb-88a9-4135-ad36-f0249621ed0d', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 1.0000, 4500.0000, 0.0000, 14.00, NULL, 5130.0000
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
        'd6a39739-0c75-4cd2-841b-2507d8bc6f78', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000016', 16, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Nova Cimangola S.A.', '5403322114', 'Estrada de Cacuaco, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3772500.0000, 528150.0000, 4300650.0000,
        0.0000, 0.0000, 'a1142a694fa57c18d5e87ea619c657e534de121bcc177f22505e9137f12bb1c7', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'A114', '1', false, 'REGIME_GERAL',
        '2026-07-13 11:20:00+00', '2026-07-13 11:20:00+00', '2026-07-13 11:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '1e840eb6-b235-4e8f-8669-af55346ca0c3', 'd6a39739-0c75-4cd2-841b-2507d8bc6f78', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 25.0000, 150000.0000, 0.0000, 14.00, NULL, 4275000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '243e44ec-3f1c-4742-b09f-039ac10af1c1', 'd6a39739-0c75-4cd2-841b-2507d8bc6f78', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
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
        'af461890-b81e-4b87-8ce5-2ec535f4efd8', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000016', 16, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Alimenta Angola Viana', '5417788992', 'Viana, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 28050.0000, 3927.0000, 31977.0000,
        0.0000, 0.0000, 'b90e2c157288215c29b70d2186407cbc8f03de7c50323898155483d0847852b7', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'B90E', '1', false, 'REGIME_GERAL',
        '2026-07-18 15:10:00+00', '2026-07-18 15:10:00+00', '2026-07-18 15:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f7098e32-46f7-48d6-997b-4ed3ff747acf', 'af461890-b81e-4b87-8ce5-2ec535f4efd8', 1, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '68b37ac6-7512-4963-885c-6a3b00e16800', 'af461890-b81e-4b87-8ce5-2ec535f4efd8', 2, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 3.0000, 1850.0000, 0.0000, 14.00, NULL, 6327.0000
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
        '45766a3d-f722-4034-8daa-c49e6886d46f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000017', 17, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Africell Angola S.A.', '5419900112', 'Edifício Kings Tower, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1350000.0000, 189000.0000, 1539000.0000,
        0.0000, 0.0000, 'a10be41c7dc692529d6295fb4ff4cca836ed56b084a386881bc335c64d248e5b', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'A10B', '1', false, 'REGIME_GERAL',
        '2026-07-23 10:30:00+00', '2026-07-23 10:30:00+00', '2026-07-23 10:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '02e69524-6f09-475a-9361-fbf6b07179db', '45766a3d-f722-4034-8daa-c49e6886d46f', 1, 'PRD-005', 'Computador Portátil HP ProBook', 3.0000, 450000.0000, 0.0000, 14.00, NULL, 1539000.0000
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
        '29c5959b-cb45-441a-9508-7e6133797816', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000017', 17, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Padaria e Pastelaria Luanda', '5418899003', 'Ingombota, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 21400.0000, 2331.0000, 23731.0000,
        0.0000, 0.0000, '5da7944228097ac3495e93087aa0faecc217951fd12a97201378dacac5403af0', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '5DA7', '1', false, 'REGIME_GERAL',
        '2026-07-29 16:40:00+00', '2026-07-29 16:40:00+00', '2026-07-29 16:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '63113a15-6e4c-4b96-a103-d18dd8f56cbf', '29c5959b-cb45-441a-9508-7e6133797816', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 9.0000, 1850.0000, 0.0000, 14.00, NULL, 18981.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '8ee86570-e008-4bee-87cc-3f1baafe1aa0', '29c5959b-cb45-441a-9508-7e6133797816', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 5.0000, 950.0000, 0.0000, 0.00, 'M04', 4750.0000
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
        '16005163-9d98-46c6-84fa-dda5c015a65e', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000018', 18, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Pumangol Lda', '5406655443', 'Zona Industrial de Viana, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 967500.0000, 135450.0000, 1102950.0000,
        0.0000, 0.0000, 'e76c5da4d83cf18072e9bf1bf995b90a5d9abfb35e4a21dda1513c26333ca752', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'E76C', '1', false, 'REGIME_GERAL',
        '2026-08-03 09:30:00+00', '2026-08-03 09:30:00+00', '2026-08-03 09:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '56ba109c-1cb3-441e-a5dd-ee8c4a434912', '16005163-9d98-46c6-84fa-dda5c015a65e', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 6.0000, 150000.0000, 0.0000, 14.00, NULL, 1026000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '8fac0201-b56a-494e-b6c3-20ec6c518a8d', '16005163-9d98-46c6-84fa-dda5c015a65e', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 15.0000, 4500.0000, 0.0000, 14.00, NULL, 76950.0000
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
        'fdc73b54-7c42-49db-9e73-829e200c7eaa', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000018', 18, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Clínica Girassol Lda', '5419900114', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 20050.0000, 0.0000, 20050.0000,
        0.0000, 0.0000, 'b72025fabd173d07d46c29a9cb2a3b8a1de935c21996a3e988caa1b0e5ed4802', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'B720', '1', false, 'REGIME_GERAL',
        '2026-08-08 14:20:00+00', '2026-08-08 14:20:00+00', '2026-08-08 14:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '2ee2dab9-edd5-4a43-80a7-c5682c9e4a0c', 'fdc73b54-7c42-49db-9e73-829e200c7eaa', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 13.0000, 950.0000, 0.0000, 0.00, 'M04', 12350.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'df632599-a1df-4c4c-a5b4-691d0c2a4733', 'fdc73b54-7c42-49db-9e73-829e200c7eaa', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 7.0000, 1100.0000, 0.0000, 0.00, 'M04', 7700.0000
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
        '29d778c8-355d-4dfb-9f4e-d8c745f46617', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000019', 19, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Refriango Indústria Lda', '5408877665', 'Complexo Industrial do Kikuxi, Viana', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 4050000.0000, 567000.0000, 4617000.0000,
        0.0000, 0.0000, 'fc053926bb331eece9ed534ab8e9c7d30122eee735478612bbc37969776a4a07', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'FC05', '1', false, 'REGIME_GERAL',
        '2026-08-14 11:15:00+00', '2026-08-14 11:15:00+00', '2026-08-14 11:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f598d32f-3a68-4e70-b183-bb912596cc60', '29d778c8-355d-4dfb-9f4e-d8c745f46617', 1, 'PRD-005', 'Computador Portátil HP ProBook', 9.0000, 450000.0000, 0.0000, 14.00, NULL, 4617000.0000
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
        '3cc97061-9fa8-42ed-be45-e17a59e19bf2', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000019', 19, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hotel Epic Sana Luanda', '5410011225', 'Rua da Missão, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 4052200.0000, 567000.0000, 4619200.0000,
        0.0000, 0.0000, 'f0189626c371dcb6dd825e6f9ac4199472ba90e34574aa3ee7503ec23d549c2e', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'F018', '1', false, 'REGIME_GERAL',
        '2026-08-19 15:50:00+00', '2026-08-19 15:50:00+00', '2026-08-19 15:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '6c733af5-aca4-42ca-8ca1-97af9b3a3579', '3cc97061-9fa8-42ed-be45-e17a59e19bf2', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 2.0000, 1100.0000, 0.0000, 0.00, 'M04', 2200.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '600d570a-6349-4f85-a56e-66abe071ca81', '3cc97061-9fa8-42ed-be45-e17a59e19bf2', 2, 'PRD-005', 'Computador Portátil HP ProBook', 9.0000, 450000.0000, 0.0000, 14.00, NULL, 4617000.0000
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
        '67be5e5e-fc72-46a8-a9df-952e1ea873a9', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000020', 20, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Grupo Castel Angola Lda', '5402211334', 'Estrada de Catete km 14, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1912500.0000, 267750.0000, 2180250.0000,
        0.0000, 0.0000, 'b8d059c0771d051f6c4c6d7af00639894e61ed960de50c93c6b4349d092e3566', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'B8D0', '1', false, 'REGIME_GERAL',
        '2026-08-25 10:05:00+00', '2026-08-25 10:05:00+00', '2026-08-25 10:05:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e12ffd7a-087c-4f87-882b-11a6e081a23a', '67be5e5e-fc72-46a8-a9df-952e1ea873a9', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 12.0000, 150000.0000, 0.0000, 14.00, NULL, 2052000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '3dc9099d-c918-429b-ac3e-740ace94ab23', '67be5e5e-fc72-46a8-a9df-952e1ea873a9', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 25.0000, 4500.0000, 0.0000, 14.00, NULL, 128250.0000
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
        '4a34d505-a198-4736-b008-ec9099c06bf6', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000020', 20, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Supermercado Candando', '5413344557', 'Talatona, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2825000.0000, 395500.0000, 3220500.0000,
        0.0000, 0.0000, '9e8ff910dbf0b5c3cfc40affecdd4d403bc75b3e44ea70a83e4a6eec06b0c476', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '9E8F', '1', false, 'REGIME_GERAL',
        '2026-08-29 16:35:00+00', '2026-08-29 16:35:00+00', '2026-08-29 16:35:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'c9c73bcf-d240-4659-b33a-38c209a831d2', '4a34d505-a198-4736-b008-ec9099c06bf6', 1, 'PRD-005', 'Computador Portátil HP ProBook', 6.0000, 450000.0000, 0.0000, 14.00, NULL, 3078000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e1061e66-3b31-4303-b710-741f58094db2', '4a34d505-a198-4736-b008-ec9099c06bf6', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 1.0000, 125000.0000, 0.0000, 14.00, NULL, 142500.0000
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
        '645dbb75-f61b-4ee5-8bb1-aa49e648b59b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000021', 21, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Unitel S.A.', '5417892341', 'Rua do Cergal 10, Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 6750000.0000, 945000.0000, 7695000.0000,
        0.0000, 0.0000, 'becdf73d4000a385f1cd8302aac50225a7f858d3cf9f8d2df3c8622257334130', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'BECD', '1', false, 'REGIME_GERAL',
        '2026-09-02 09:45:00+00', '2026-09-02 09:45:00+00', '2026-09-02 09:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '3fadc7b6-bfa9-437e-aed2-0200cebd5860', '645dbb75-f61b-4ee5-8bb1-aa49e648b59b', 1, 'PRD-005', 'Computador Portátil HP ProBook', 15.0000, 450000.0000, 0.0000, 14.00, NULL, 7695000.0000
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
        '20185bdb-2782-4fa3-95e6-502f4d03f620', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000021', 21, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Distribuidora Viana Lda', '5414455668', 'Viana Park, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 1700000.0000, 238000.0000, 1938000.0000,
        0.0000, 0.0000, '99a3f1d223a2c68a3c582b974dee7d07573a6c54601621c46634dddadd25129c', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '99A3', '1', false, 'REGIME_GERAL',
        '2026-09-07 13:20:00+00', '2026-09-07 13:20:00+00', '2026-09-07 13:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '0f1e78a8-d8ef-4229-9ee5-5308ec8cd1b7', '20185bdb-2782-4fa3-95e6-502f4d03f620', 1, 'PRD-006', 'Monitor LED 24 polegadas Dell', 10.0000, 125000.0000, 0.0000, 14.00, NULL, 1425000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '36086cb5-57fb-470e-bbbf-20f414b886dd', '20185bdb-2782-4fa3-95e6-502f4d03f620', 2, 'SRV-001', 'Consultoria e Suporte Técnico TI', 3.0000, 150000.0000, 0.0000, 14.00, NULL, 513000.0000
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
        '4a207deb-07b7-4bae-a62b-03f51c891c91', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000022', 22, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Banco BAI S.A.', '5401234567', 'Avenida Lenine 35, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2857500.0000, 400050.0000, 3257550.0000,
        0.0000, 0.0000, 'ee4a8b45ffe5c280ac4d17abde42410cd2bb121c44799b2ff5fe3e662d333e73', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'EE4A', '1', false, 'REGIME_GERAL',
        '2026-09-12 11:00:00+00', '2026-09-12 11:00:00+00', '2026-09-12 11:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '7d238d61-6cbb-47d4-910e-5e9a73024180', '4a207deb-07b7-4bae-a62b-03f51c891c91', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 18.0000, 150000.0000, 0.0000, 14.00, NULL, 3078000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e47947f1-f4f1-4618-8574-04d03bdff3bd', '4a207deb-07b7-4bae-a62b-03f51c891c91', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 35.0000, 4500.0000, 0.0000, 14.00, NULL, 179550.0000
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
        '44c910e3-f9ad-4eb1-a5b9-810869f63925', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000022', 22, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Papelaria Central Lda', '5415566779', 'Mutamba, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 2525000.0000, 353500.0000, 2878500.0000,
        0.0000, 0.0000, '837ddb993987fa685e5e2bab635db74e72b4e2f74fe49c1bf6da08e777eb7e95', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '837D', '1', false, 'REGIME_GERAL',
        '2026-09-17 15:40:00+00', '2026-09-17 15:40:00+00', '2026-09-17 15:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'a3c0b087-abe9-4471-8d9c-ba0c76c553b3', '44c910e3-f9ad-4eb1-a5b9-810869f63925', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 14.0000, 150000.0000, 0.0000, 14.00, NULL, 2394000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'ec6fd48b-5806-46a0-af9d-68f6027ce827', '44c910e3-f9ad-4eb1-a5b9-810869f63925', 2, 'SRV-002', 'Serviços de Manutenção e Rede', 5.0000, 85000.0000, 0.0000, 14.00, NULL, 484500.0000
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
        'f44abe61-a540-4cce-968d-13ae2621724c', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000023', 23, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Sonangol Distribuidora E.P.', '5400012345', 'Rua Rainha Ginga 29, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 9450000.0000, 1323000.0000, 10773000.0000,
        0.0000, 0.0000, 'a3837ffb46612a77695c88f3d8706dec8b0de13750c202889344832f55c33635', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'A383', '1', false, 'REGIME_GERAL',
        '2026-09-22 10:30:00+00', '2026-09-22 10:30:00+00', '2026-09-22 10:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '4bff7e7f-c6c5-4a4a-9c27-97ccd44039db', 'f44abe61-a540-4cce-968d-13ae2621724c', 1, 'PRD-005', 'Computador Portátil HP ProBook', 21.0000, 450000.0000, 0.0000, 14.00, NULL, 10773000.0000
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
        'b2d0b018-e595-4053-a6e2-649d8d39daca', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000023', 23, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Consumidor Final', '999999999', 'Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 286500.0000, 40110.0000, 326610.0000,
        0.0000, 0.0000, 'f54669540b436b58345a27982b146b4edaf532fcf0257145c1b2d8aa083d3b97', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'F546', '1', false, 'REGIME_GERAL',
        '2026-09-28 16:55:00+00', '2026-09-28 16:55:00+00', '2026-09-28 16:55:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '63183205-ef88-4c4a-ade6-026b51028f3a', 'b2d0b018-e595-4053-a6e2-649d8d39daca', 1, 'SRV-002', 'Serviços de Manutenção e Rede', 3.0000, 85000.0000, 0.0000, 14.00, NULL, 290700.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '978a3b9f-106f-484d-97d8-b061d059886a', 'b2d0b018-e595-4053-a6e2-649d8d39daca', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 7.0000, 4500.0000, 0.0000, 14.00, NULL, 35910.0000
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
        '1d13c8cf-a860-4806-b0f0-1d2ba2740e7d', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000024', 24, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Catoca Sociedade Mineira', '5409876543', 'Saurimo, Lunda Sul', 'Saurimo', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3622500.0000, 507150.0000, 4129650.0000,
        0.0000, 0.0000, '64d02e7edc92aee380c22eb41fb8a9fcae0c9d49b832c106264adbe895b42a71', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '64D0', '1', false, 'REGIME_GERAL',
        '2026-10-02 09:30:00+00', '2026-10-02 09:30:00+00', '2026-10-02 09:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'f44ece05-5a49-4010-bbe7-4dabe7449235', '1d13c8cf-a860-4806-b0f0-1d2ba2740e7d', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 24.0000, 150000.0000, 0.0000, 14.00, NULL, 4104000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '456da0b6-39c3-485c-8d13-57cd9e163d33', '1d13c8cf-a860-4806-b0f0-1d2ba2740e7d', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 5.0000, 4500.0000, 0.0000, 14.00, NULL, 25650.0000
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
        '808665a2-1921-4922-ab3c-dff9a0dfc006', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000024', 24, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hipermercado Kero', '5412233445', 'Nova Vida, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 48150.0000, 6741.0000, 54891.0000,
        0.0000, 0.0000, 'c54239138d245da2b14af811cd848715a84cefd33c5896a9b1f819868f9a50c3', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'C542', '1', false, 'REGIME_GERAL',
        '2026-10-05 14:10:00+00', '2026-10-05 14:10:00+00', '2026-10-05 14:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '5a8f4131-d7e0-4c60-9b9f-d680c71ce017', '808665a2-1921-4922-ab3c-dff9a0dfc006', 1, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 7.0000, 4500.0000, 0.0000, 14.00, NULL, 35910.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'b67225fa-45e3-4500-9794-c2de4c74b0b5', '808665a2-1921-4922-ab3c-dff9a0dfc006', 2, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 9.0000, 1850.0000, 0.0000, 14.00, NULL, 18981.0000
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
        'fa493dc1-b33e-4034-ba56-c63fe4de3c62', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000025', 25, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'ENSA Seguros de Angola', '5412345678', 'Largo 4 de Fevereiro, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 900000.0000, 126000.0000, 1026000.0000,
        0.0000, 0.0000, '44bcdb8338e7a5c681a5c1709c79f0309170c3ae92c36c6f03596ad785b2fe23', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '44BC', '1', false, 'REGIME_GERAL',
        '2026-10-08 11:15:00+00', '2026-10-08 11:15:00+00', '2026-10-08 11:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '9abc34b0-16bd-4da2-9790-d9f44bf6f52c', 'fa493dc1-b33e-4034-ba56-c63fe4de3c62', 1, 'PRD-005', 'Computador Portátil HP ProBook', 2.0000, 450000.0000, 0.0000, 14.00, NULL, 1026000.0000
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
        '90e09474-f673-4349-97b8-11199d3f8f25', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000025', 25, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Restaurante Marginal', '5415566778', 'Ilha de Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 21300.0000, 2849.0000, 24149.0000,
        0.0000, 0.0000, '89a6d81def744af748f50e00821c7c445e5fd98109eb0e8be00718d6891055ba', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '89A6', '1', false, 'REGIME_GERAL',
        '2026-10-11 16:20:00+00', '2026-10-11 16:20:00+00', '2026-10-11 16:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '4ca54719-71ef-4d27-8476-56a69c837b59', '90e09474-f673-4349-97b8-11199d3f8f25', 1, 'PROD-002', 'Óleo Alimentar Kudiba 1L', 11.0000, 1850.0000, 0.0000, 14.00, NULL, 23199.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '44b735cc-f8c9-49ad-997f-6c4c14875d6a', '90e09474-f673-4349-97b8-11199d3f8f25', 2, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 1.0000, 950.0000, 0.0000, 0.00, 'M04', 950.0000
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
        'b6081baa-3845-4e8f-9a78-35255b5f37c0', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000026', 26, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Angola Telecom E.P.', '5405556677', 'Rua Frederico Welwitsch, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 817500.0000, 114450.0000, 931950.0000,
        0.0000, 0.0000, 'c5886d5eba47f06e79f4420ed952e7a9f9cf5520c1ab4d8f96d4f4a46661d68f', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'C588', '1', false, 'REGIME_GERAL',
        '2026-10-14 10:00:00+00', '2026-10-14 10:00:00+00', '2026-10-14 10:00:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '300ff691-7b51-4b8e-b217-9a60a304f2a5', 'b6081baa-3845-4e8f-9a78-35255b5f37c0', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 5.0000, 150000.0000, 0.0000, 14.00, NULL, 855000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'fec30e4a-a846-46a1-a6b9-ec15be6e5d5c', 'b6081baa-3845-4e8f-9a78-35255b5f37c0', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 15.0000, 4500.0000, 0.0000, 14.00, NULL, 76950.0000
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
        'd7f2dbd2-aac3-4ce5-aef9-5b22457c0a5f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000026', 26, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Farmácia Popular Lda', '5416677880', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 17550.0000, 0.0000, 17550.0000,
        0.0000, 0.0000, '08d4a7ec2f692efed6622d8c596a0b1a8270d13198d4e394d3d020036dc26f2c', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '08D4', '1', false, 'REGIME_GERAL',
        '2026-10-16 15:45:00+00', '2026-10-16 15:45:00+00', '2026-10-16 15:45:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '7247c551-73d9-4062-9ced-c41d3757f78f', 'd7f2dbd2-aac3-4ce5-aef9-5b22457c0a5f', 1, 'PROD-003', 'Farinha de Trigo Nacional 1Kg', 15.0000, 950.0000, 0.0000, 0.00, 'M04', 14250.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '694d6c1f-4f3b-4943-b7f8-433307a86bd6', 'd7f2dbd2-aac3-4ce5-aef9-5b22457c0a5f', 2, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 3.0000, 1100.0000, 0.0000, 0.00, 'M04', 3300.0000
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
        '20a32291-997f-439e-8834-7990428a442f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000027', 27, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'TAAG Linhas Aéreas de Angola', '5401122334', 'Rua da Missão 123, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 3600000.0000, 504000.0000, 4104000.0000,
        0.0000, 0.0000, 'd1ab10b21536b67d804493afcec460d3b93c59f2398bca335debf60276710477', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'D1AB', '1', false, 'REGIME_GERAL',
        '2026-10-18 11:30:00+00', '2026-10-18 11:30:00+00', '2026-10-18 11:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '572f210f-f80c-4f9d-a66a-f9efe7b5dea4', '20a32291-997f-439e-8834-7990428a442f', 1, 'PRD-005', 'Computador Portátil HP ProBook', 8.0000, 450000.0000, 0.0000, 14.00, NULL, 4104000.0000
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
        'cd5ee403-e96f-4653-9980-a04847c34d1f', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000027', 27, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Alimenta Angola Viana', '5417788992', 'Viana, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 2254400.0000, 315000.0000, 2569400.0000,
        0.0000, 0.0000, '06f047f2d94921fe0a97a97ce7a5518a5d963ef4acec8b88fc17bc53601af091', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '06F0', '1', false, 'REGIME_GERAL',
        '2026-10-20 14:20:00+00', '2026-10-20 14:20:00+00', '2026-10-20 14:20:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '480d63d9-34c8-4b5b-81d7-1cbd073a613e', 'cd5ee403-e96f-4653-9980-a04847c34d1f', 1, 'PROD-004', 'Açúcar Branco Kudiba 1Kg', 4.0000, 1100.0000, 0.0000, 0.00, 'M04', 4400.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e9c481d9-040d-424b-b7fa-db82ef51ea21', 'cd5ee403-e96f-4653-9980-a04847c34d1f', 2, 'PRD-005', 'Computador Portátil HP ProBook', 5.0000, 450000.0000, 0.0000, 14.00, NULL, 2565000.0000
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
        'a426966e-7462-4c18-98a9-89135afe4feb', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000028', 28, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Porto de Luanda E.P.', '5409988776', 'Largo do Porto, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 1762500.0000, 246750.0000, 2009250.0000,
        0.0000, 0.0000, 'af908c4c5b155af0edd5ef956305aa15940f0578c27a4a05e640aeb794af9853', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'AF90', '1', false, 'REGIME_GERAL',
        '2026-10-22 09:50:00+00', '2026-10-22 09:50:00+00', '2026-10-22 09:50:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '93710faf-685e-4d09-a296-5d0b3be4b2da', 'a426966e-7462-4c18-98a9-89135afe4feb', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 11.0000, 150000.0000, 0.0000, 14.00, NULL, 1881000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd8375749-206d-495e-9ae3-9df731dc3f9a', 'a426966e-7462-4c18-98a9-89135afe4feb', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 25.0000, 4500.0000, 0.0000, 14.00, NULL, 128250.0000
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
        '45951955-07be-4c2a-a5e2-a2d712f27653', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000028', 28, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Padaria e Pastelaria Luanda', '5418899003', 'Ingombota, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 4475000.0000, 626500.0000, 5101500.0000,
        0.0000, 0.0000, '3e297bd29d1cac792b7af233698a4538bb625121d3ee51e4fb8947eff239324b', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '3E29', '1', false, 'REGIME_GERAL',
        '2026-10-23 16:10:00+00', '2026-10-23 16:10:00+00', '2026-10-23 16:10:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'e23aa355-3596-48e4-84b9-0928ac6a059e', '45951955-07be-4c2a-a5e2-a2d712f27653', 1, 'PRD-005', 'Computador Portátil HP ProBook', 8.0000, 450000.0000, 0.0000, 14.00, NULL, 4104000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '816051b2-d80a-4b7d-b64c-2d1d3a768c63', '45951955-07be-4c2a-a5e2-a2d712f27653', 2, 'PRD-006', 'Monitor LED 24 polegadas Dell', 7.0000, 125000.0000, 0.0000, 14.00, NULL, 997500.0000
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
        '7af725e1-0524-4e92-ae51-cc7142ca4142', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000029', 29, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Banco BFA S.A.', '5402233445', 'Rua Major Kanhangulo, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 6300000.0000, 882000.0000, 7182000.0000,
        0.0000, 0.0000, 'bf3ecbadbd24695f18016f556863fb2458f7fa2c0e5e91da9f88de88ce8e9e03', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'BF3E', '1', false, 'REGIME_GERAL',
        '2026-10-24 11:15:00+00', '2026-10-24 11:15:00+00', '2026-10-24 11:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'c5374bc3-ea1e-4d89-80da-4231701e7500', '7af725e1-0524-4e92-ae51-cc7142ca4142', 1, 'PRD-005', 'Computador Portátil HP ProBook', 14.0000, 450000.0000, 0.0000, 14.00, NULL, 7182000.0000
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
        'd1399d40-8b70-4cfe-ac29-7bedf919966b', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000029', 29, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Clínica Girassol Lda', '5419900114', 'Maianga, Luanda', 'Luanda', 'AO',
        ARRAY['NUMERARIO'], 'AOA', 2850000.0000, 399000.0000, 3249000.0000,
        0.0000, 0.0000, '73a3f88ea9096490dffcffcd4b398cbfe97efffb44e087e6c4d02827fc98eb17', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '73A3', '1', false, 'REGIME_GERAL',
        '2026-10-24 17:30:00+00', '2026-10-24 17:30:00+00', '2026-10-24 17:30:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'c71cc3a9-f8da-44ef-8b93-488e5e8e3c80', 'd1399d40-8b70-4cfe-ac29-7bedf919966b', 1, 'PRD-006', 'Monitor LED 24 polegadas Dell', 12.0000, 125000.0000, 0.0000, 14.00, NULL, 1710000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd40d6c1e-e61f-4d28-a99f-ad98b5fce928', 'd1399d40-8b70-4cfe-ac29-7bedf919966b', 2, 'SRV-001', 'Consultoria e Suporte Técnico TI', 9.0000, 150000.0000, 0.0000, 14.00, NULL, 1539000.0000
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
        '0a365e97-981e-4379-b5a8-24ce88d171e6', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'FT 2026B/000030', 30, 'FT',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Soba Store Angola Lda', '5416677889', 'Avenida Comandante Valódia, Luanda', 'Luanda', 'AO',
        ARRAY['TRANSFERENCIA'], 'AOA', 2707500.0000, 379050.0000, 3086550.0000,
        0.0000, 0.0000, 'e62a94904999775ed26b5868d0b0f55a440c3906ca3fdadaa7cec63825f9d7c7', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        'E62A', '1', false, 'REGIME_GERAL',
        '2026-10-25 09:40:00+00', '2026-10-25 09:40:00+00', '2026-10-25 09:40:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '77f60866-94a4-4ba6-aa08-141c473ad251', '0a365e97-981e-4379-b5a8-24ce88d171e6', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 17.0000, 150000.0000, 0.0000, 14.00, NULL, 2907000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'd3314362-063b-4392-b893-ab7fc37274b7', '0a365e97-981e-4379-b5a8-24ce88d171e6', 2, 'PROD-001', 'Arroz Agulha Kudiba 5Kg', 35.0000, 4500.0000, 0.0000, 14.00, NULL, 179550.0000
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
        '31d23042-eaa2-4df6-8419-cff18d6cb847', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'FR 2026B/000030', 30, 'FR',
        '5001234567', 'Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda', 'Luanda', 'AO',
        'Hotel Epic Sana Luanda', '5410011225', 'Rua da Missão, Luanda', 'Luanda', 'AO',
        ARRAY['MULTICAIXA'], 'AOA', 235000.0000, 32900.0000, 267900.0000,
        0.0000, 0.0000, '32dc5466a39815ab66a31a4f02d32fbe0f3c824168e350753a4508454a7fee9a', 'MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0==',
        '32DC', '1', false, 'REGIME_GERAL',
        '2026-10-25 14:15:00+00', '2026-10-25 14:15:00+00', '2026-10-25 14:15:00+00'
    );
    

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '2b0c9595-44f7-489a-8a66-3c6460930e33', '31d23042-eaa2-4df6-8419-cff18d6cb847', 1, 'SRV-001', 'Consultoria e Suporte Técnico TI', 1.0000, 150000.0000, 0.0000, 14.00, NULL, 171000.0000
        );
        

        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            'c81159c5-d64f-4de8-acde-d6866d7a5fb7', '31d23042-eaa2-4df6-8419-cff18d6cb847', 2, 'SRV-002', 'Serviços de Manutenção e Rede', 1.0000, 85000.0000, 0.0000, 14.00, NULL, 96900.0000
        );
        

INSERT INTO kudiba_core.series_fiscais (id, tenant_id, document_type, series_code, fiscal_year, current_sequence, last_hash, is_active)
VALUES 
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'FT', '2026B', 2026, 30, 'e62a94904999775ed26b5868d0b0f55a440c3906ca3fdadaa7cec63825f9d7c7', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'FR', '2026B', 2026, 30, '32dc5466a39815ab66a31a4f02d32fbe0f3c824168e350753a4508454a7fee9a', true)
ON CONFLICT (tenant_id, document_type, series_code, fiscal_year) DO UPDATE 
SET current_sequence = EXCLUDED.current_sequence, last_hash = EXCLUDED.last_hash, is_active = true;

COMMIT;