-- =============================================================================
-- KUDIBA ERP - BOOTSTRAP INICIAL DO UTILIZADOR SYSADMIN (SUPERADMIN)
-- Executado na inicialização dos containers / implantação inicial
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_sysadmin_id UUID := 'e0000000-0000-0000-0000-000000000000';
    v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_branch_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_sysadmin_email VARCHAR(255) := 'sysadmin@kudiba.ao';
    -- Hash Argon2id para 'SysAdmin@Kudiba2026!'
    v_default_password_hash VARCHAR(255) := '$argon2id$v=19$m=65536,t=3,p=4$rHAeTRMxVrHMsiP7B4E1rA$V2s8TnKIGXxg3UEJ7VHzIkQSwtQH3F+a9HfCnjBTyW8';
BEGIN
    -- 1. Garante existência do utilizador sysadmin
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
        v_sysadmin_id,
        v_sysadmin_email,
        '+244 923 000 001',
        'Administrador do Sistema (SYSADMIN)',
        v_default_password_hash,
        TRUE,
        TRUE,
        0,
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        is_active = TRUE,
        is_superadmin = TRUE,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    RETURNING id INTO v_sysadmin_id;

    -- 2. Garante o papel SYSADMIN e ADMIN na tabela de papéis
    INSERT INTO kudiba_core.roles (id, name, description, is_system) VALUES
        ('SYSADMIN', 'Administrador do Sistema', 'Gestão integral do sistema ERP: empresas, licenças, configurações globais e suporte técnico', TRUE),
        ('ADMIN', 'Administrador Geral', 'Acesso total à administração da empresa, utilizadores e configurações fiscais', TRUE)
    ON CONFLICT (id) DO UPDATE SET
        is_system = TRUE;

    -- 3. Garante associação do sysadmin ao tenant padrão
    IF EXISTS (SELECT 1 FROM kudiba_core.tenants WHERE id = v_tenant_id) THEN
        INSERT INTO kudiba_core.user_tenants (
            user_id,
            tenant_id,
            default_branch_id,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_sysadmin_id,
            v_tenant_id,
            v_branch_id,
            'ACTIVE',
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            status = 'ACTIVE',
            updated_at = NOW();

        -- 4. Atribui papéis SYSADMIN e ADMIN
        INSERT INTO kudiba_core.user_roles (user_id, tenant_id, role_id, assigned_at) VALUES
            (v_sysadmin_id, v_tenant_id, 'SYSADMIN', NOW()),
            (v_sysadmin_id, v_tenant_id, 'ADMIN', NOW())
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
            v_sysadmin_id,
            v_tenant_id,
            'SYSADMIN_BOOTSTRAPPED',
            v_sysadmin_email,
            '{"event": "SYSADMIN_PROVISIONED_ON_CONTAINER_DEPLOY", "status": "ACTIVE"}'::jsonb,
            NOW()
        );
    END IF;

    RAISE NOTICE 'Utilizador SYSADMIN (%) provisionado com sucesso.', v_sysadmin_email;
END $$;
