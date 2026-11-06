-- =============================================================================
-- KUDIBA ERP - PROVISIONAMENTO DO UTILIZADOR VENDEDOR / OPERADOR DE CAIXA (POS)
-- Perfil: OPERADOR_CAIXA (Vendas balcão, caixa, clientes e catálogo)
-- =============================================================================

DO $$
DECLARE
    v_vendedor_id UUID := 'e0000000-0000-0000-0000-000000000002';
    v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_branch_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_vendedor_email VARCHAR(255) := 'vendedor@kudiba.ao';
    -- Hash Argon2id para 'Vendedor@Kudiba2026!'
    v_password_hash VARCHAR(255) := '$argon2id$v=19$m=65536,t=3,p=4$CgwbBddaWMqVWN6d0cJWtA$eEnAbj6SoBk/E6zG4r/7bu0uVGGiIvQQF2cFaOXoSEE';
BEGIN
    -- 1. Garante existência do utilizador vendedor
    INSERT INTO kudiba_core.users (
        id,
        email,
        phone_number,
        full_name,
        password_hash,
        is_active,
        is_superadmin,
        failed_login_attempts,
        locked_until,
        created_at,
        updated_at
    ) VALUES (
        v_vendedor_id,
        v_vendedor_email,
        '+244 923 000 002',
        'Vendedor de Balcão (POS)',
        v_password_hash,
        TRUE,
        FALSE,
        0,
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        is_active = TRUE,
        password_hash = v_password_hash,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    RETURNING id INTO v_vendedor_id;

    -- 2. Garante o papel OPERADOR_CAIXA na tabela de papéis
    INSERT INTO kudiba_core.roles (id, name, description, is_system) VALUES
        ('OPERADOR_CAIXA', 'Operador de Caixa (POS)', 'Emissão de faturas no ponto de venda, leitura X e operações diárias', TRUE)
    ON CONFLICT (id) DO UPDATE SET
        is_system = TRUE;

    -- 3. Garante associação do vendedor ao tenant
    IF EXISTS (SELECT 1 FROM kudiba_core.tenants WHERE id = v_tenant_id) THEN
        INSERT INTO kudiba_core.user_tenants (
            user_id,
            tenant_id,
            default_branch_id,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_vendedor_id,
            v_tenant_id,
            v_branch_id,
            'ACTIVE',
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            status = 'ACTIVE',
            updated_at = NOW();

        -- 4. Atribui exclusivamente o papel OPERADOR_CAIXA
        DELETE FROM kudiba_core.user_roles 
        WHERE user_id = v_vendedor_id AND tenant_id = v_tenant_id;

        INSERT INTO kudiba_core.user_roles (user_id, tenant_id, role_id, assigned_at) VALUES
            (v_vendedor_id, v_tenant_id, 'OPERADOR_CAIXA', NOW())
        ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING;
    END IF;

    -- 5. Registo na trilha de auditoria
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'kudiba_audit' AND table_name = 'auth_audit_log') THEN
        INSERT INTO kudiba_audit.auth_audit_log (
            user_id,
            tenant_id,
            action,
            email_attempted,
            details,
            created_at
        ) VALUES (
            v_vendedor_id,
            v_tenant_id,
            'VENDEDOR_PROVISIONED',
            v_vendedor_email,
            '{"event": "VENDEDOR_CASHIER_PROVISIONED", "role": "OPERADOR_CAIXA"}'::jsonb,
            NOW()
        );
    END IF;

    RAISE NOTICE 'Utilizador VENDEDOR (%) provisionado com perfil OPERADOR_CAIXA.', v_vendedor_email;
END $$;
