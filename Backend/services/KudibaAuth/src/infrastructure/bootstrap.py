import logging
import uuid
from typing import Dict, List, Set, Tuple
from sqlalchemy import select
from src.infrastructure.persistence.models import (
    PermissionModel,
    RoleModel,
    RolePermissionModel,
    TenantModel,
    UserModel,
    UserRoleModel,
    UserTenantModel,
)
from src.infrastructure.persistence.unit_of_work import session_scope
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher

logger = logging.getLogger("kudiba.auth.bootstrap")

CANONICAL_PERMISSIONS: List[Tuple[str, str, str, str]] = [
    # Fiscal
    ("invoices:issue", "fiscal", "Emitir Facturas", "Permissão para emitir facturas, facturas-recibo e outros documentos fiscais"),
    ("invoices:read", "fiscal", "Consultar Facturas", "Permissão para consultar documentos e imprimir vias"),
    ("invoices:cancel", "fiscal", "Anular Facturas", "Permissão para emitir Notas de Crédito de rectificação/anulação"),
    ("fiscal:series:manage", "fiscal", "Gerir Séries Fiscais", "Abertura e configuração de séries de facturação"),
    ("fiscal:saft:export", "fiscal", "Exportar SAF-T (AO)", "Geração e exportação do ficheiro oficial SAF-T"),
    ("fiscal:reports:read", "fiscal", "Consultar Mapas Fiscais", "Acesso aos relatórios de IVA, retenções e imposto de selo"),
    ("customers:read", "fiscal", "Consultar Clientes", "Consulta da lista de clientes, fichas comerciais e histórico de compras"),
    ("customers:manage", "fiscal", "Gerir Clientes & NIF", "Criação, actualização de dados cadastrais e validação do NIF de clientes"),
    ("invoices:proforma", "fiscal", "Orçamentos & Facturas Proforma", "Emissão, actualização e conversão de orçamentos e facturas proforma"),
    ("invoices:transport", "fiscal", "Guias de Transporte & Remessa", "Emissão de guias de transporte rodoviário e movimentação física de bens"),
    ("invoices:receipts", "fiscal", "Recibos Autónomos de Quitação (RG)", "Emissão de recibos de liquidação total ou parcial de facturas a crédito"),
    ("invoices:debit_note", "fiscal", "Emitir Notas de Débito", "Emissão de notas de débito para cobrança de acertos e despesas a clientes"),

    # POS
    ("pos:sale", "pos", "Operar Ponto de Venda", "Registo de vendas directas no caixa"),
    ("pos:reading_x", "pos", "Efectuar Leitura X", "Conferência intradiária de valores em caixa"),
    ("pos:closing_z", "pos", "Efectuar Fecho Z", "Fecho diário oficial e geração de memória fiscal"),
    ("pos:cash_movements", "pos", "Sangrias & Suprimentos de Caixa", "Registo de reforços e retiradas de valores na gaveta do operador de caixa"),
    ("pos:discounts", "pos", "Aplicar Descontos Manuais", "Aplicação de descontos comerciais em linha ou no total da venda no POS"),

    # Auth & Administração
    ("users:read", "auth", "Listar Utilizadores", "Visualização de utilizadores da organização"),
    ("users:invite", "auth", "Convidar Utilizadores", "Envio de convites e associação de utilizadores à empresa"),
    ("users:manage_roles", "auth", "Gerir Papéis de Utilizadores", "Atribuição e revogação de funções de utilizadores"),
    ("audit:read", "auth", "Consultar Registos de Auditoria", "Visualização da trilha de auditoria fiscal, eventos de autenticação e logs de segurança"),
    ("tenant:settings:manage", "core", "Gerir Dados da Empresa", "Actualização de dados fiscais e cadastrais da empresa"),

    # Inventário
    ("inventory:read", "inventory", "Consultar Inventário", "Consulta de produtos, existências por armazém e histórico de movimentos"),
    ("inventory:manage", "inventory", "Gerir Produtos e Existências", "Criação e actualização de produtos, unidades de medida e níveis mínimos de stock"),
    ("inventory:transfer", "inventory", "Transferir Stock entre Armazéns", "Criação e processamento de transferências de mercadorias entre armazéns"),
    ("inventory:warehouses", "inventory", "Gerir Armazéns & Lojas", "Parametrização de armazéns físicos, locais de guarda e centros de distribuição"),
    ("inventory:adjust", "inventory", "Ajustes & Contagem de Stock", "Registo de quebras, sobras, perdas e acertos pontuais de existências"),
    ("inventory:suppliers", "inventory", "Fornecedores & Compras", "Gestão do cadastro de fornecedores, encomendas de compra e preços acordados"),

    # Tesouraria
    ("treasury:read", "treasury", "Consultar Tesouraria & Caixas", "Consulta de saldos de caixas, extractos de contas bancárias e posições financeiras"),
    ("treasury:manage", "treasury", "Gerir Caixas & Contas Bancárias", "Configuração de caixas físicos, contas bancárias da empresa e métodos de pagamento"),
    ("treasury:movements", "treasury", "Movimentos de Caixa & Despesas", "Lançamento de despesas correntes, entradas e saídas de caixa da tesouraria"),
    ("treasury:transfers", "treasury", "Transferências entre Contas", "Realização de transferências entre caixas e contas bancárias da empresa"),
    ("treasury:reconcile", "treasury", "Reconciliação Bancária", "Conferência de extractos bancários, cruzamento de saldos e reconciliação financeira"),

    # Recursos Humanos & Salários
    ("payroll:manage", "payroll", "Gerir Colaboradores e Contratos", "Registo, actualização e cessação de colaboradores, departamentos e contratos"),
    ("payroll:view", "payroll", "Consultar Folha Salarial", "Consulta de recibos, períodos e resumos de processamento salarial"),
    ("payroll:calculate", "payroll", "Processar Salários", "Cálculo da folha salarial do período (IRT e INSS)"),
    ("payroll:approve", "payroll", "Aprovar e Encerrar Períodos", "Aprovação e encerramento oficial do período salarial"),
    ("payroll:export", "payroll", "Exportar Remessa Bancária", "Geração do ficheiro PS2 de transferências em lote"),
    ("payroll:hr", "payroll", "Gerir Férias e Assiduidade", "Pedidos de férias, aprovações e registos de assiduidade"),

    # Contabilidade
    ("accounting:read", "accounting", "Consultar Contabilidade & Razão", "Consulta do plano de contas, diários, extractos de conta e balancetes"),
    ("accounting:journal", "accounting", "Lançamentos Contabilísticos Manuais", "Registo e estorno de lançamentos em partidas dobradas nos diários oficiais"),
    ("accounting:chart", "accounting", "Gerir Plano Geral de Contas (PGC)", "Criação e manutenção de contas e subcontas das classes 1 a 8 do PGC Angolano"),
    ("accounting:vat_settlement", "accounting", "Apuramento Periódico de IVA", "Cálculo, fecho e apuramento do IVA a pagar ou a recuperar perante a administração fiscal"),
    ("accounting:reports", "accounting", "Balanço & Demonstração de Resultados", "Geração do Balanço analítico, Balancete de Verificação e Demonstração de Resultados"),

    # Integrações
    ("integrations:read", "integrations", "Consultar Dispositivos & Presenças", "Visualização de terminais biométricos conectados, webhooks e marcações de ponto"),
    ("integrations:manage", "integrations", "Gerir Terminais & Mapeamentos", "Parametrização de terminais biométricos (Hikvision, ZKTeco, Anviz) e regras de sincronização"),
]

CANONICAL_ROLES: List[Tuple[str, str, str, bool]] = [
    ("ADMIN", "Administrador Geral", "Acesso total à administração da empresa, utilizadores e configurações fiscais", True),
    ("SYSADMIN", "Administrador do Sistema", "Gestão integral do sistema ERP: empresas, licenças, configurações globais e suporte técnico", True),
    ("CONTABILISTA", "Contabilista Certificado", "Acesso à faturação, fechos de contas, exportação SAF-T e mapas fiscais", True),
    ("OPERADOR_CAIXA", "Operador de Caixa (POS)", "Emissão de faturas no ponto de venda, leitura X e operações diárias", True),
    ("GESTOR_STOCK", "Gestor de Stocks", "Controle de inventário, transferências de armazém e guias de transporte", True),
    ("AUDITOR", "Auditor Fiscal / Revisor", "Acesso de leitura para auditoria e conferência de trilha fiscal", True),
    ("GESTOR_RH", "Gestor de Recursos Humanos", "Gestão de colaboradores, contratos, folha salarial, férias e assiduidade", True),
]

ROLE_PERMISSION_MAP: Dict[str, List[str]] = {
    "CONTABILISTA": [
        "customers:read", "customers:manage", "invoices:proforma", "invoices:receipts",
        "invoices:debit_note", "invoices:issue", "invoices:read", "invoices:cancel",
        "fiscal:series:manage", "fiscal:saft:export", "fiscal:reports:read",
        "treasury:read", "treasury:movements", "treasury:reconcile",
        "accounting:read", "accounting:journal", "accounting:chart",
        "accounting:vat_settlement", "accounting:reports", "audit:read",
    ],
    "OPERADOR_CAIXA": [
        "pos:sale", "pos:reading_x", "pos:closing_z", "pos:cash_movements", "pos:discounts",
        "invoices:read", "invoices:receipts", "treasury:read",
    ],
    "GESTOR_STOCK": [
        "inventory:read", "inventory:manage", "inventory:transfer", "inventory:warehouses",
        "inventory:adjust", "inventory:suppliers", "invoices:transport", "invoices:read",
    ],
    "AUDITOR": [
        "invoices:read", "fiscal:reports:read", "fiscal:saft:export", "treasury:read",
        "accounting:read", "audit:read", "inventory:read", "payroll:view",
    ],
    "GESTOR_RH": [
        "payroll:manage", "payroll:view", "payroll:calculate", "payroll:approve",
        "payroll:export", "payroll:hr", "integrations:read", "audit:read",
    ],
}


async def ensure_rbac_catalog_bootstrapped(session_factory) -> bool:
    """Garante que o catálogo canónico de permissões, papéis do sistema e associações estão inicializados."""
    try:
        async with session_scope(session_factory) as (session, owns_session):
            res_perms = await session.execute(select(PermissionModel.id))
            existing_perm_ids: Set[str] = set(res_perms.scalars().all())

            for pid, mod, name, desc in CANONICAL_PERMISSIONS:
                if pid not in existing_perm_ids:
                    session.add(PermissionModel(id=pid, module=mod, name=name, description=desc))
                    existing_perm_ids.add(pid)

            res_roles = await session.execute(select(RoleModel.id))
            existing_role_ids: Set[str] = set(res_roles.scalars().all())

            for rid, rname, rdesc, is_sys in CANONICAL_ROLES:
                if rid not in existing_role_ids:
                    session.add(RoleModel(id=rid, name=rname, description=rdesc, is_system=is_sys))
                    existing_role_ids.add(rid)

            res_rp = await session.execute(select(RolePermissionModel.role_id, RolePermissionModel.permission_id))
            existing_role_perms: Set[Tuple[str, str]] = set(res_rp.all())

            # ADMIN e SYSADMIN têm todas as permissões
            all_perm_ids = [p[0] for p in CANONICAL_PERMISSIONS]
            for admin_role in ["ADMIN", "SYSADMIN"]:
                for pid in all_perm_ids:
                    if (admin_role, pid) not in existing_role_perms:
                        session.add(RolePermissionModel(role_id=admin_role, permission_id=pid))
                        existing_role_perms.add((admin_role, pid))

            # Restantes papéis de sistema com matriz canónica
            for role_id, perm_list in ROLE_PERMISSION_MAP.items():
                for pid in perm_list:
                    if (role_id, pid) not in existing_role_perms:
                        session.add(RolePermissionModel(role_id=role_id, permission_id=pid))
                        existing_role_perms.add((role_id, pid))

            if owns_session:
                await session.commit()

            logger.info("Catálogo canónico de permissões RBAC assegurado na base de dados.")
            return True
    except Exception as e:
        logger.warning("Falha não-bloqueante no bootstrap do catálogo RBAC: %s", e)
        return False


async def ensure_sysadmin_bootstrapped(
    session_factory,
    email: str,
    password: str,
    full_name: str = "Administrador do Sistema (SYSADMIN)",
    tenant_slug: str = "demo",
    password_hasher: Argon2PasswordHasher = None,
) -> bool:
    clean_email = email.strip().lower()
    if not clean_email or not password:
        raise ValueError("SYSADMIN bootstrap requires an explicit email and password.")

    hasher = password_hasher or Argon2PasswordHasher()

    async with session_scope(session_factory) as (session, owns_session):
        # 1. Obter ou validar o tenant alvo
        tenant_stmt = select(TenantModel).where(TenantModel.slug == tenant_slug)
        res_tenant = await session.execute(tenant_stmt)
        tenant = res_tenant.scalar_one_or_none()
        if not tenant:
            # Fallback para o primeiro tenant existente
            res_any = await session.execute(select(TenantModel).limit(1))
            tenant = res_any.scalar_one_or_none()

        if not tenant:
            logger.warning("Nenhum tenant encontrado para associar o utilizador SYSADMIN.")
            return False

        # 2. Obter ou criar o utilizador
        user_stmt = select(UserModel).where(UserModel.email == clean_email)
        res_user = await session.execute(user_stmt)
        user = res_user.scalar_one_or_none()

        if not user:
            pw_hash = hasher.hash(password)
            user = UserModel(
                id=uuid.uuid4(),
                email=clean_email,
                full_name=full_name,
                password_hash=pw_hash,
                is_active=True,
                is_superadmin=True,
                failed_login_attempts=0,
                locked_until=None,
            )
            session.add(user)
            await session.flush()
            logger.info("Utilizador SYSADMIN criado com sucesso: %s", clean_email)
        else:
            user.is_active = True
            user.is_superadmin = True
            user.failed_login_attempts = 0
            user.locked_until = None
            if password:
                user.password_hash = hasher.hash(password)
            await session.flush()
            logger.info("Utilizador SYSADMIN atualizado e reativado: %s", clean_email)

        # 3. Garantir associação no tenant
        ut_stmt = select(UserTenantModel).where(
            UserTenantModel.user_id == user.id,
            UserTenantModel.tenant_id == tenant.id,
        )
        res_ut = await session.execute(ut_stmt)
        user_tenant = res_ut.scalar_one_or_none()

        if not user_tenant:
            user_tenant = UserTenantModel(
                user_id=user.id,
                tenant_id=tenant.id,
                status="ACTIVE",
            )
            session.add(user_tenant)
            await session.flush()
        else:
            user_tenant.status = "ACTIVE"
            await session.flush()

        # 4. Atribuir papéis SYSADMIN e ADMIN
        for role_code in ["SYSADMIN", "ADMIN"]:
            ur_stmt = select(UserRoleModel).where(
                UserRoleModel.user_id == user.id,
                UserRoleModel.tenant_id == tenant.id,
                UserRoleModel.role_id == role_code,
            )
            res_ur = await session.execute(ur_stmt)
            if not res_ur.scalar_one_or_none():
                ur = UserRoleModel(
                    user_id=user.id,
                    tenant_id=tenant.id,
                    role_id=role_code,
                )
                session.add(ur)

        if owns_session:
            await session.commit()

        logger.info("Privilégios de SYSADMIN e ADMIN assegurados para %s na empresa %s.", clean_email, tenant.company_name)
        return True
