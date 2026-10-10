from typing import Any, Dict, List
from src.domain.ports.user_tenant_repository import IUserTenantRepository


class ListRolesUseCase:
    """Caso de uso de listagem de catálogo de perfis e permissões do sistema (CQRS Query)."""
    def __init__(self, user_tenant_repo: IUserTenantRepository):
        self.user_tenant_repo = user_tenant_repo

    async def execute(self) -> List[Dict[str, Any]]:
        # Perfis do sistema
        system_roles = [
            ("ADMIN", "Administrador Geral", "Acesso total à administração da empresa e configurações fiscais"),
            ("CONTABILISTA", "Contabilista Certificado", "Acesso à faturação, fechos, exportação SAF-T e mapas fiscais"),
            ("OPERADOR_CAIXA", "Operador de Caixa (POS)", "Emissão de faturas no ponto de venda e leitura X"),
            ("GESTOR_STOCK", "Gestor de Stocks", "Controle de inventário, armazéns e guias de transporte"),
            ("AUDITOR", "Auditor Fiscal / Revisor", "Acesso de leitura para auditoria e trilha fiscal"),
        ]

        results = []
        for r_id, r_name, r_desc in system_roles:
            perms = await self.user_tenant_repo.get_roles_permissions([r_id])
            results.append({
                "id": r_id,
                "name": r_name,
                "description": r_desc,
                "permissions": perms,
            })
        return results
