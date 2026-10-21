from enum import Enum

ADMINISTRATOR_ROLE_IDS = frozenset({"SUPER_ADMIN", "SYSADMIN", "ADMIN"})


class RoleType(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    SYSADMIN = "SYSADMIN"
    ADMIN = "ADMIN"
    CONTABILISTA = "CONTABILISTA"
    OPERADOR_CAIXA = "OPERADOR_CAIXA"
    GESTOR_STOCK = "GESTOR_STOCK"
    GESTOR_RH = "GESTOR_RH"
    AUDITOR = "AUDITOR"

    @classmethod
    def is_valid(cls, role: str) -> bool:
        try:
            cls(role.upper())
            return True
        except ValueError:
            return False

    @classmethod
    def is_administrator(cls, role: str) -> bool:
        """Perfis de administrador: acesso total e permissões imutáveis."""
        return role.strip().upper() in ADMINISTRATOR_ROLE_IDS
