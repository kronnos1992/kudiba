BEGIN;

DELETE FROM kudiba_treasury.treasury_receipt_lines WHERE receipt_id IN (
    SELECT id FROM kudiba_treasury.treasury_receipts WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
);
DELETE FROM kudiba_treasury.treasury_receipts WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM kudiba_treasury.invoice_receivables WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM kudiba_treasury.cash_movements WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';


INSERT INTO kudiba_treasury.cash_registers (id, tenant_id, code, name, is_active)
VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CAIXA-01', 'Caixa Principal - Sede', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO kudiba_treasury.bank_accounts (id, tenant_id, bank_name, account_number, iban, currency, current_balance, is_active)
VALUES ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Banco BAI', '0045123456789', 'AO06004000009123456789012', 'AOA', 28500000.0000, true)
ON CONFLICT (tenant_id, iban) DO UPDATE SET current_balance = 28500000.0000;

INSERT INTO kudiba_treasury.cash_sessions (id, tenant_id, register_id, operator_user_id, status, opening_balance, notes)
VALUES ('s0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'operador@kudiba.ao', 'OPEN', 50000.0000, 'Sessão contínua de demonstração')
ON CONFLICT DO NOTHING;


        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '84e27464-6500-4d04-8f59-f3782c7cd1f2', 'FT 2026B/000001', 'FT', 'TRANSFERENCIA', 2565000.0000, 'SETTLED', '2026-01-08 10:15:00+00', '2026-01-08 10:15:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '9c07341a-d727-4ba1-a66c-e79bf5393034', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000001', '5417892341', 'Unitel S.A.', '5417892341', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 2565000.0000, 'AOA', '2026-01-08 10:15:00+00', '2026-01-08 10:15:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 13395.0000, 'Venda FR 2026B/000001 - Consumidor Final', 'operador@kudiba.ao', '2026-01-16 14:30:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '541a2dd6-b19e-4335-aacd-44efbf3ad733', 'FT 2026B/000002', 'FT', 'TRANSFERENCIA', 1444950.0000, 'SETTLED', '2026-01-24 11:20:00+00', '2026-01-24 11:20:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '2fc1b9f5-e229-48ad-a1f0-21c2c51cbd6f', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000002', '5401234567', 'Banco BAI S.A.', '5401234567', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 1444950.0000, 'AOA', '2026-01-24 11:20:00+00', '2026-01-24 11:20:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 14050.0000, 'Venda FR 2026B/000002 - Hipermercado Kero', 'operador@kudiba.ao', '2026-01-29 16:45:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'ca113803-13dc-4825-967a-a3a9cdb9926c', 'FT 2026B/000003', 'FT', 'TRANSFERENCIA', 5643000.0000, 'SETTLED', '2026-02-05 09:30:00+00', '2026-02-05 09:30:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'c2c06b6d-58e3-44a7-9317-12c1e4219c01', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000003', '5400012345', 'Sonangol Distribuidora E.P.', '5400012345', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 5643000.0000, 'AOA', '2026-02-05 09:30:00+00', '2026-02-05 09:30:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 3605300.0000, 'Venda FR 2026B/000003 - Restaurante Marginal', 'operador@kudiba.ao', '2026-02-14 15:10:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'b609f6f5-e9ad-451d-a2f1-0cb27d62a5fa', 'FT 2026B/000004', 'FT', 'TRANSFERENCIA', 2522250.0000, 'SETTLED', '2026-02-20 11:50:00+00', '2026-02-20 11:50:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'a5085a49-b54d-4db1-a5a4-f482f20854ee', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000004', '5409876543', 'Catoca Sociedade Mineira', '5409876543', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 2522250.0000, 'AOA', '2026-02-20 11:50:00+00', '2026-02-20 11:50:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2308500.0000, 'Venda FR 2026B/000004 - Farmácia Popular Lda', 'operador@kudiba.ao', '2026-02-26 17:00:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '57515db1-f326-4925-bd40-249a24d31773', 'FT 2026B/000005', 'FT', 'TRANSFERENCIA', 8721000.0000, 'SETTLED', '2026-03-04 10:00:00+00', '2026-03-04 10:00:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '51a07861-c88a-4245-84b4-a162fd6e4b5b', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000005', '5412345678', 'ENSA Seguros de Angola', '5412345678', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 8721000.0000, 'AOA', '2026-03-04 10:00:00+00', '2026-03-04 10:00:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 1026000.0000, 'Venda FR 2026B/000005 - Alimenta Angola Viana', 'operador@kudiba.ao', '2026-03-12 13:40:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '559dba58-adbe-45e7-b3c1-318297e5ca74', 'FT 2026B/000006', 'FT', 'TRANSFERENCIA', 3599550.0000, 'SETTLED', '2026-03-19 16:15:00+00', '2026-03-19 16:15:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '5bc36835-2707-4d73-9a57-d707eaa497a4', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000006', '5405556677', 'Angola Telecom E.P.', '5405556677', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 3599550.0000, 'AOA', '2026-03-19 16:15:00+00', '2026-03-19 16:15:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2000700.0000, 'Venda FR 2026B/000006 - Padaria e Pastelaria Luanda', 'operador@kudiba.ao', '2026-03-27 12:25:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '7c41a7fb-d840-4045-bf85-242695a3b5ca', 'FT 2026B/000007', 'FT', 'TRANSFERENCIA', 11799000.0000, 'SETTLED', '2026-04-03 09:45:00+00', '2026-04-03 09:45:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'bbea9c15-3ebc-402c-962f-4843a1cc9018', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000007', '5401122334', 'TAAG Linhas Aéreas de Angola', '5401122334', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 11799000.0000, 'AOA', '2026-04-03 09:45:00+00', '2026-04-03 09:45:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 1382250.0000, 'Venda FR 2026B/000007 - Clínica Girassol Lda', 'operador@kudiba.ao', '2026-04-11 14:15:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'cbb3d912-5b68-4ce0-b836-b3eee178fc8b', 'FT 2026B/000008', 'FT', 'TRANSFERENCIA', 4471650.0000, 'SETTLED', '2026-04-18 11:30:00+00', '2026-04-18 11:30:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '9d4b093e-e00b-4917-b9df-246a2516cd85', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000008', '5409988776', 'Porto de Luanda E.P.', '5409988776', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 4471650.0000, 'AOA', '2026-04-18 11:30:00+00', '2026-04-18 11:30:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 30153.0000, 'Venda FR 2026B/000008 - Hotel Epic Sana Luanda', 'operador@kudiba.ao', '2026-04-24 16:50:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'd485c472-dce1-4a88-b5ad-d6a25e2d0ec8', 'FT 2026B/000009', 'FT', 'TRANSFERENCIA', 2052000.0000, 'SETTLED', '2026-05-04 09:20:00+00', '2026-05-04 09:20:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'd0ad5fc5-5dee-4d23-b56a-aa5dc7c4198b', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000009', '5402233445', 'Banco BFA S.A.', '5402233445', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 2052000.0000, 'AOA', '2026-05-04 09:20:00+00', '2026-05-04 09:20:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 23313.0000, 'Venda FR 2026B/000009 - Supermercado Candando', 'operador@kudiba.ao', '2026-05-09 14:15:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '21992f4b-8663-4e00-891c-87ce6ccdda95', 'FT 2026B/000010', 'FT', 'TRANSFERENCIA', 1273950.0000, 'SETTLED', '2026-05-15 11:00:00+00', '2026-05-15 11:00:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '1dd53fc6-a366-44fa-b667-c8877ea02238', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000010', '5416677889', 'Soba Store Angola Lda', '5416677889', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 1273950.0000, 'AOA', '2026-05-15 11:00:00+00', '2026-05-15 11:00:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 11550.0000, 'Venda FR 2026B/000010 - Distribuidora Viana Lda', 'operador@kudiba.ao', '2026-05-20 16:30:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a1acc981-6b15-4e98-8a73-f05120c187b4', 'FT 2026B/000011', 'FT', 'TRANSFERENCIA', 5130000.0000, 'SETTLED', '2026-05-26 10:45:00+00', '2026-05-26 10:45:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '27104a32-991e-458e-a44f-60b4565b5280', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000011', '5413344556', 'Multitel Serviços de Telecomunicações', '5413344556', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 5130000.0000, 'AOA', '2026-05-26 10:45:00+00', '2026-05-26 10:45:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 1555500.0000, 'Venda FR 2026B/000011 - Papelaria Central Lda', 'operador@kudiba.ao', '2026-05-30 15:20:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'fa8b57f3-5f92-4711-9269-c29b9079f9a7', 'FT 2026B/000012', 'FT', 'TRANSFERENCIA', 2351250.0000, 'SETTLED', '2026-06-03 10:10:00+00', '2026-06-03 10:10:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '7122cf53-5804-4fe7-b0ba-9b76cfc125dc', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000012', '5407788990', 'TotalEnergies EP Angola', '5407788990', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 2351250.0000, 'AOA', '2026-06-03 10:10:00+00', '2026-06-03 10:10:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2764500.0000, 'Venda FR 2026B/000012 - Consumidor Final', 'operador@kudiba.ao', '2026-06-08 14:50:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '26aca03c-c72f-4f94-943c-3e2e767a135f', 'FT 2026B/000013', 'FT', 'TRANSFERENCIA', 8208000.0000, 'SETTLED', '2026-06-14 11:35:00+00', '2026-06-14 11:35:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'be32928b-f391-4049-bd3b-77f0600b67ed', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000013', '5418899001', 'Angola Cables S.A.', '5418899001', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 8208000.0000, 'AOA', '2026-06-14 11:35:00+00', '2026-06-14 11:35:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2337000.0000, 'Venda FR 2026B/000013 - Hipermercado Kero', 'operador@kudiba.ao', '2026-06-18 16:00:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'cd1c2c0f-d66d-4c4d-97e6-31518be8602b', 'FT 2026B/000014', 'FT', 'TRANSFERENCIA', 3428550.0000, 'SETTLED', '2026-06-23 09:40:00+00', '2026-06-23 09:40:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'b029f335-cd90-4a18-85a5-a0bce3e0a6fa', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000014', '5404455667', 'Secil Marítima S.A.', '5404455667', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 3428550.0000, 'AOA', '2026-06-23 09:40:00+00', '2026-06-23 09:40:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2924100.0000, 'Venda FR 2026B/000014 - Restaurante Marginal', 'operador@kudiba.ao', '2026-06-29 17:15:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'eef37aaf-38a8-4735-b113-6988d5fc6ae9', 'FT 2026B/000015', 'FT', 'TRANSFERENCIA', 11286000.0000, 'SETTLED', '2026-07-02 09:15:00+00', '2026-07-02 09:15:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'bccf2a18-7962-4170-9e56-76b4fa8e1c5b', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000015', '5411122334', 'Standard Bank Angola', '5411122334', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 11286000.0000, 'AOA', '2026-07-02 09:15:00+00', '2026-07-02 09:15:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 102030.0000, 'Venda FR 2026B/000015 - Farmácia Popular Lda', 'operador@kudiba.ao', '2026-07-07 13:45:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'd6a39739-0c75-4cd2-841b-2507d8bc6f78', 'FT 2026B/000016', 'FT', 'TRANSFERENCIA', 4300650.0000, 'SETTLED', '2026-07-13 11:20:00+00', '2026-07-13 11:20:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '673e6d53-35ce-4191-bccf-bc9f1cbb96e4', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000016', '5403322114', 'Nova Cimangola S.A.', '5403322114', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 4300650.0000, 'AOA', '2026-07-13 11:20:00+00', '2026-07-13 11:20:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 31977.0000, 'Venda FR 2026B/000016 - Alimenta Angola Viana', 'operador@kudiba.ao', '2026-07-18 15:10:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '45766a3d-f722-4034-8daa-c49e6886d46f', 'FT 2026B/000017', 'FT', 'TRANSFERENCIA', 1539000.0000, 'SETTLED', '2026-07-23 10:30:00+00', '2026-07-23 10:30:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '06883432-4f99-4dbb-85d1-bb76f8351858', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000017', '5419900112', 'Africell Angola S.A.', '5419900112', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 1539000.0000, 'AOA', '2026-07-23 10:30:00+00', '2026-07-23 10:30:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 23731.0000, 'Venda FR 2026B/000017 - Padaria e Pastelaria Luanda', 'operador@kudiba.ao', '2026-07-29 16:40:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '16005163-9d98-46c6-84fa-dda5c015a65e', 'FT 2026B/000018', 'FT', 'TRANSFERENCIA', 1102950.0000, 'SETTLED', '2026-08-03 09:30:00+00', '2026-08-03 09:30:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '8874e80d-e342-4430-8b48-224e6e15b2da', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000018', '5406655443', 'Pumangol Lda', '5406655443', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 1102950.0000, 'AOA', '2026-08-03 09:30:00+00', '2026-08-03 09:30:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 20050.0000, 'Venda FR 2026B/000018 - Clínica Girassol Lda', 'operador@kudiba.ao', '2026-08-08 14:20:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '29d778c8-355d-4dfb-9f4e-d8c745f46617', 'FT 2026B/000019', 'FT', 'TRANSFERENCIA', 4617000.0000, 'SETTLED', '2026-08-14 11:15:00+00', '2026-08-14 11:15:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '1ed0d5d7-f1ac-4a1d-b360-fd47eea1a6a0', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000019', '5408877665', 'Refriango Indústria Lda', '5408877665', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 4617000.0000, 'AOA', '2026-08-14 11:15:00+00', '2026-08-14 11:15:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 4619200.0000, 'Venda FR 2026B/000019 - Hotel Epic Sana Luanda', 'operador@kudiba.ao', '2026-08-19 15:50:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '67be5e5e-fc72-46a8-a9df-952e1ea873a9', 'FT 2026B/000020', 'FT', 'TRANSFERENCIA', 2180250.0000, 'SETTLED', '2026-08-25 10:05:00+00', '2026-08-25 10:05:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'cf17c8b5-f2f2-4f05-b03a-3da100cceff6', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000020', '5402211334', 'Grupo Castel Angola Lda', '5402211334', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 2180250.0000, 'AOA', '2026-08-25 10:05:00+00', '2026-08-25 10:05:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 3220500.0000, 'Venda FR 2026B/000020 - Supermercado Candando', 'operador@kudiba.ao', '2026-08-29 16:35:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '645dbb75-f61b-4ee5-8bb1-aa49e648b59b', 'FT 2026B/000021', 'FT', 'TRANSFERENCIA', 7695000.0000, 'SETTLED', '2026-09-02 09:45:00+00', '2026-09-02 09:45:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '0aa90f3b-bdc8-447c-a0f1-d2cddf1f1538', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000021', '5417892341', 'Unitel S.A.', '5417892341', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 7695000.0000, 'AOA', '2026-09-02 09:45:00+00', '2026-09-02 09:45:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 1938000.0000, 'Venda FR 2026B/000021 - Distribuidora Viana Lda', 'operador@kudiba.ao', '2026-09-07 13:20:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '4a207deb-07b7-4bae-a62b-03f51c891c91', 'FT 2026B/000022', 'FT', 'TRANSFERENCIA', 3257550.0000, 'SETTLED', '2026-09-12 11:00:00+00', '2026-09-12 11:00:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '2968d3d4-4cfb-4543-9b81-50ca41db6d9b', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000022', '5401234567', 'Banco BAI S.A.', '5401234567', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 3257550.0000, 'AOA', '2026-09-12 11:00:00+00', '2026-09-12 11:00:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2878500.0000, 'Venda FR 2026B/000022 - Papelaria Central Lda', 'operador@kudiba.ao', '2026-09-17 15:40:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'f44abe61-a540-4cce-968d-13ae2621724c', 'FT 2026B/000023', 'FT', 'TRANSFERENCIA', 10773000.0000, 'SETTLED', '2026-09-22 10:30:00+00', '2026-09-22 10:30:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '52d4a196-0205-4c2d-b562-c35cb3ac2b05', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000023', '5400012345', 'Sonangol Distribuidora E.P.', '5400012345', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 10773000.0000, 'AOA', '2026-09-22 10:30:00+00', '2026-09-22 10:30:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 326610.0000, 'Venda FR 2026B/000023 - Consumidor Final', 'operador@kudiba.ao', '2026-09-28 16:55:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '1d13c8cf-a860-4806-b0f0-1d2ba2740e7d', 'FT 2026B/000024', 'FT', 'TRANSFERENCIA', 4129650.0000, 'SETTLED', '2026-10-02 09:30:00+00', '2026-10-02 09:30:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '45ef0d5f-bd1e-41d5-a6f9-19462c11a553', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000024', '5409876543', 'Catoca Sociedade Mineira', '5409876543', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 4129650.0000, 'AOA', '2026-10-02 09:30:00+00', '2026-10-02 09:30:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 54891.0000, 'Venda FR 2026B/000024 - Hipermercado Kero', 'operador@kudiba.ao', '2026-10-05 14:10:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'fa493dc1-b33e-4034-ba56-c63fe4de3c62', 'FT 2026B/000025', 'FT', 'TRANSFERENCIA', 1026000.0000, 'SETTLED', '2026-10-08 11:15:00+00', '2026-10-08 11:15:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'd4b36f1e-1280-4a58-9af7-44fe938817ba', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000025', '5412345678', 'ENSA Seguros de Angola', '5412345678', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 1026000.0000, 'AOA', '2026-10-08 11:15:00+00', '2026-10-08 11:15:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 24149.0000, 'Venda FR 2026B/000025 - Restaurante Marginal', 'operador@kudiba.ao', '2026-10-11 16:20:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'b6081baa-3845-4e8f-9a78-35255b5f37c0', 'FT 2026B/000026', 'FT', 'TRANSFERENCIA', 931950.0000, 'SETTLED', '2026-10-14 10:00:00+00', '2026-10-14 10:00:00+00'
        );
        

            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                'f3dccfa0-718c-4554-96cd-1640cd79a3a9', 'a0000000-0000-0000-0000-000000000001', 'RC 2026/000026', '5405556677', 'Angola Telecom E.P.', '5405556677', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', 931950.0000, 'AOA', '2026-10-14 10:00:00+00', '2026-10-14 10:00:00+00'
            );
            

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 17550.0000, 'Venda FR 2026B/000026 - Farmácia Popular Lda', 'operador@kudiba.ao', '2026-10-16 15:45:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '20a32291-997f-439e-8834-7990428a442f', 'FT 2026B/000027', 'FT', 'TRANSFERENCIA', 4104000.0000, 'OUTSTANDING', '2026-10-18 11:30:00+00', '2026-10-18 11:30:00+00'
        );
        

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 2569400.0000, 'Venda FR 2026B/000027 - Alimenta Angola Viana', 'operador@kudiba.ao', '2026-10-20 14:20:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a426966e-7462-4c18-98a9-89135afe4feb', 'FT 2026B/000028', 'FT', 'TRANSFERENCIA', 2009250.0000, 'OUTSTANDING', '2026-10-22 09:50:00+00', '2026-10-22 09:50:00+00'
        );
        

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 5101500.0000, 'Venda FR 2026B/000028 - Padaria e Pastelaria Luanda', 'operador@kudiba.ao', '2026-10-23 16:10:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '7af725e1-0524-4e92-ae51-cc7142ca4142', 'FT 2026B/000029', 'FT', 'TRANSFERENCIA', 7182000.0000, 'OUTSTANDING', '2026-10-24 11:15:00+00', '2026-10-24 11:15:00+00'
        );
        

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 3249000.0000, 'Venda FR 2026B/000029 - Clínica Girassol Lda', 'operador@kudiba.ao', '2026-10-24 17:30:00+00'
        );
        

        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '0a365e97-981e-4379-b5a8-24ce88d171e6', 'FT 2026B/000030', 'FT', 'TRANSFERENCIA', 3086550.0000, 'OUTSTANDING', '2026-10-25 09:40:00+00', '2026-10-25 09:40:00+00'
        );
        

        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', 267900.0000, 'Venda FR 2026B/000030 - Hotel Epic Sana Luanda', 'operador@kudiba.ao', '2026-10-25 14:15:00+00'
        );
        
COMMIT;