-- ============================================================================
-- Seed de Casos Realistas de Gestão de Conflitos Laborais (Angola LGT 12/23)
-- Base de dados: kudiba_payroll
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_c1 UUID := gen_random_uuid();
    v_c2 UUID := gen_random_uuid();
    v_c3 UUID := gen_random_uuid();
    v_c4 UUID := gen_random_uuid();
    v_dept_ops UUID;
    v_dept_com UUID;
    v_dept_fin UUID;
    v_emp1 UUID := 'e0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- Obter ou criar departamentos
    SELECT id INTO v_dept_fin FROM kudiba_payroll.departments WHERE tenant_id = v_tenant_id LIMIT 1;
    
    INSERT INTO kudiba_payroll.departments (tenant_id, code, name, description)
    VALUES 
        (v_tenant_id, 'DEP-OPS', 'Operações & Logística', 'Armazéns, frota e expedição'),
        (v_tenant_id, 'DEP-COM', 'Comercial & Vendas', 'Atendimento a clientes e grandes contas')
    ON CONFLICT (tenant_id, code) DO NOTHING;

    SELECT id INTO v_dept_ops FROM kudiba_payroll.departments WHERE tenant_id = v_tenant_id AND code = 'DEP-OPS';
    SELECT id INTO v_dept_com FROM kudiba_payroll.departments WHERE tenant_id = v_tenant_id AND code = 'DEP-COM';

    -- 1. CASO 1: Divergência de Turnos e Horas Extras (Em Mediação)
    INSERT INTO kudiba_payroll.conflict_cases (
        id, tenant_id, reference_code, title, conflict_type, severity, status,
        department_id, department_name, incident_date, reported_at, is_confidential,
        complainant_employee_id, complainant_name, respondent_name,
        assigned_mediator_id, assigned_mediator_name, resolution_route,
        summary, retaliation_risk, urgent_protection_measures
    ) VALUES (
        v_c1, v_tenant_id, 'RH-CON-2026-0001',
        'Divergência na escala de piquetes de fim-de-semana e cálculo de horas extraordinárias',
        'CONDICOES_TRABALHO', 'MEDIA', 'EM_MEDIACAO',
        v_dept_ops, 'Operações & Logística', CURRENT_DATE - INTERVAL '6 days', NOW() - INTERVAL '5 days', false,
        v_emp1, 'Carlos Fernando', 'Manuel Domingos (Supervisor de Armazém)',
        'admin@kudiba.ao', 'Dra. Elsa Gaspar (Técnica Sénior de RH)', 'MEDIACAO',
        'O colaborador Carlos Fernando relata que tem sido escalado consecutivamente para três fins-de-semana de piquete sem compensação equitativa com os restantes operadores de armazém, gerando sobrecarga física e desgaste na equipa.',
        false, NULL
    ) ON CONFLICT (tenant_id, reference_code) DO NOTHING;

    -- Participantes Caso 1
    INSERT INTO kudiba_payroll.conflict_participants (case_id, tenant_id, name, role, statement, statement_date)
    VALUES
        (v_c1, v_tenant_id, 'Carlos Fernando', 'COMPLAINANT', 'Gostaria de uma escala transparente e partilhada com antecedência mínima de 15 dias, de acordo com o regulamento interno.', NOW() - INTERVAL '4 days'),
        (v_c1, v_tenant_id, 'Manuel Domingos', 'RESPONDENT', 'A escala decorreu de ausências médicas não planeadas de outros dois operadores. Não houve qualquer intenção de prejudicar o trabalhador.', NOW() - INTERVAL '3 days'),
        (v_c1, v_tenant_id, 'Dra. Elsa Gaspar', 'MEDIATOR', 'Processo conduzido com neutralidade e foco no bem-estar e cumprimento das regras de descanso obrigatório da LGT.', NOW() - INTERVAL '2 days');

    -- Reunião de Mediação Caso 1
    INSERT INTO kudiba_payroll.conflict_meetings (
        case_id, tenant_id, meeting_type, scheduled_at, location, conducted_by, attendees, minutes, agreed_points, status
    ) VALUES (
        v_c1, v_tenant_id, 'JOINT_MEDIATION', NOW() - INTERVAL '2 days', 'Sala de Reuniões de RH (Sede)',
        'Dra. Elsa Gaspar', 'Carlos Fernando, Manuel Domingos, Dra. Elsa Gaspar',
        'Reunião de mediação conjunta realizada com cordialidade. Foram ouvidas ambas as perspetivas sobre os constrangimentos operacionais do armazém e a necessidade de salvaguardar o descanso semanal.',
        '1. Elaboração de escala rotativa mensal pública com afixação até ao dia 25 de cada mês. 2. Compensação com descanso no início da próxima semana.',
        'COMPLETED'
    );

    -- Ações do Plano de Resolução Caso 1
    INSERT INTO kudiba_payroll.conflict_actions (case_id, tenant_id, title, description, action_type, assigned_to, due_date, status)
    VALUES
        (v_c1, v_tenant_id, 'Nova Escala Rotativa Transparente', 'Implementar modelo de escala mensal afixada no armazém e auditada pelo RH quinzenalmente.', 'COMPROMISSO_CONDUTA', 'Manuel Domingos', CURRENT_DATE + INTERVAL '5 days', 'IN_PROGRESS'),
        (v_c1, v_tenant_id, 'Auditoria de Descanso Obrigatório', 'Verificar conformidade dos descansos compensatórios nos termos da Lei Geral do Trabalho 12/23.', 'OUTRO', 'Dra. Elsa Gaspar', CURRENT_DATE + INTERVAL '10 days', 'PENDING');

    -- Logs de Auditoria Caso 1
    INSERT INTO kudiba_payroll.conflict_audit_logs (case_id, tenant_id, action, performed_by, details)
    VALUES
        (v_c1, v_tenant_id, 'CREATE', 'admin@kudiba.ao', 'Participação registada formalmente pelo RH.'),
        (v_c1, v_tenant_id, 'STATUS_CHANGE', 'admin@kudiba.ao', 'Estado alterado de EM_TRIAGEM para EM_MEDIACAO após parecer favorável das partes.'),
        (v_c1, v_tenant_id, 'MEETING_SCHEDULED', 'admin@kudiba.ao', 'Sessão de mediação conjunta realizada e ata homologada.');

    -- 2. CASO 2: Denúncia Confidencial de Assédio Moral (Em Investigação / Medidas Cautelares)
    INSERT INTO kudiba_payroll.conflict_cases (
        id, tenant_id, reference_code, title, conflict_type, severity, status,
        department_id, department_name, incident_date, reported_at, is_confidential,
        complainant_employee_id, complainant_name, respondent_name,
        assigned_mediator_id, assigned_mediator_name, resolution_route,
        summary, retaliation_risk, urgent_protection_measures
    ) VALUES (
        v_c2, v_tenant_id, 'RH-CON-2026-0002',
        'Denúncia de assédio moral e tratamento vexatório reiterado em reuniões de equipa',
        'ASSEDIO_MORAL', 'CRITICA', 'EM_INVESTIGACAO',
        v_dept_com, 'Comercial & Vendas', CURRENT_DATE - INTERVAL '10 days', NOW() - INTERVAL '8 days', true,
        NULL, 'Colaboradora Protegida (Confidencial)', 'Dr. António M. (Chefe de Equipa Vendas)',
        'admin@kudiba.ao', 'Comissão Disciplinar & Direção de RH', 'INVESTIGACAO_DISCIPLINAR',
        'Denúncia confidencial relatando episódios reiterados de humilhação pública, ameaças veladas de despedimento sem fundamento e isolamento profissional de membros da equipa de vendas.',
        true, 'Medida cautelar adotada nos termos do art. 51º da LGT: transferência provisória da tutela hierárquica e proibição de contacto laboral direto durante as averiguações.'
    ) ON CONFLICT (tenant_id, reference_code) DO NOTHING;

    -- Ações do Caso 2
    INSERT INTO kudiba_payroll.conflict_actions (case_id, tenant_id, title, description, action_type, assigned_to, due_date, status)
    VALUES
        (v_c2, v_tenant_id, 'Averiguação Prévia Disciplinar (LGT 12/23)', 'Instauração formal de inquérito preliminar e inquirição de testemunhas indicadas no processo.', 'PROCESSO_DISCIPLINAR_LGT', 'Jurídico & RH', CURRENT_DATE + INTERVAL '12 days', 'IN_PROGRESS'),
        (v_c2, v_tenant_id, 'Garantia de Não Retaliação', 'Acompanhamento semanal com a participante para assegurar ausência de represálias diretas ou indiretas.', 'OUTRO', 'Dra. Elsa Gaspar', CURRENT_DATE + INTERVAL '20 days', 'IN_PROGRESS');

    -- Logs de Auditoria Caso 2
    INSERT INTO kudiba_payroll.conflict_audit_logs (case_id, tenant_id, action, performed_by, details)
    VALUES
        (v_c2, v_tenant_id, 'CREATE', 'admin@kudiba.ao', 'Participação confidencial submetida com proteção de identidade.'),
        (v_c2, v_tenant_id, 'STATUS_CHANGE', 'admin@kudiba.ao', 'Classificado como gravidade CRÍTICA e encaminhado para averiguação independente (sem mediação direta por desequilíbrio de poder).');

    -- 3. CASO 3: Divergência de Metas e Conflito Interpessoal (Em Acompanhamento)
    INSERT INTO kudiba_payroll.conflict_cases (
        id, tenant_id, reference_code, title, conflict_type, severity, status,
        department_id, department_name, incident_date, reported_at, is_confidential,
        complainant_name, respondent_name,
        assigned_mediator_id, assigned_mediator_name, resolution_route,
        summary, retaliation_risk
    ) VALUES (
        v_c3, v_tenant_id, 'RH-CON-2026-0003',
        'Conflito interpessoal entre gestores de conta por sobreposição de carteira de clientes',
        'INTERPESSOAL', 'MEDIA', 'EM_ACOMPANHAMENTO',
        v_dept_com, 'Comercial & Vendas', CURRENT_DATE - INTERVAL '25 days', NOW() - INTERVAL '20 days', false,
        'Margarida Afonso', 'João Baptista',
        'admin@kudiba.ao', 'Dra. Elsa Gaspar', 'MEDIACAO',
        'Divergência sobre a distribuição de clientes corporativos de grande porte no setor de distribuição em Luanda.',
        false
    ) ON CONFLICT (tenant_id, reference_code) DO NOTHING;

    -- Follow-up do Caso 3
    INSERT INTO kudiba_payroll.conflict_follow_ups (
        case_id, tenant_id, review_date, reviewed_by, feedback_complainant, feedback_respondent, retaliation_detected, is_stable, notes
    ) VALUES (
        v_c3, v_tenant_id, CURRENT_DATE - INTERVAL '2 days', 'Dra. Elsa Gaspar',
        'A divisão territorial definida no acordo funcionou perfeitamente. O clima de colaboração restabeleceu-se.',
        'Satisfeito com a clareza das novas regras de atribuição de comissões.',
        false, true, 'Situação considerada estabilizada. Próxima revisão agendada para 60 dias.'
    );

    -- 4. CASO 4: Divergência Salarial e Categoria (Resolvido)
    INSERT INTO kudiba_payroll.conflict_cases (
        id, tenant_id, reference_code, title, conflict_type, severity, status,
        department_id, department_name, incident_date, reported_at, is_confidential,
        complainant_name, respondent_name,
        assigned_mediator_id, assigned_mediator_name, resolution_route,
        summary, retaliation_risk, closure_reason, closed_at
    ) VALUES (
        v_c4, v_tenant_id, 'RH-CON-2026-0004',
        'Revisão de enquadramento de categoria profissional de assistente para técnico júnior',
        'SALARIAL', 'BAIXA', 'RESOLVIDO',
        v_dept_fin, 'Departamento Financeiro', CURRENT_DATE - INTERVAL '40 days', NOW() - INTERVAL '35 days', false,
        'Beatriz Silva', 'Direção Financeira',
        'admin@kudiba.ao', 'Dra. Elsa Gaspar', 'MEDIACAO',
        'Pedido de clarificação e progressão após conclusão de licenciatura e assunção de tarefas analíticas.',
        false, 'Reclassificação profissional aprovada pela Direção Geral e refletida no aditamento ao contrato de trabalho.',
        NOW() - INTERVAL '10 days'
    ) ON CONFLICT (tenant_id, reference_code) DO NOTHING;

END $$;
