from enum import Enum

IMMUTABLE_ADMIN_ROLE_IDS = frozenset({"SUPER_ADMIN", "SYSADMIN"})
ADMINISTRATOR_ROLE_IDS = frozenset({"SUPER_ADMIN", "SYSADMIN", "ADMIN"})
ADMIN_ROLE_IDS = frozenset({"ADMIN"})


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
    def is_immutable_admin(cls, role: str) -> bool:
        """Perfis de administrador imutáveis: só SYSADMIN e SUPER_ADMIN."""
        return role.strip().upper() in IMMUTABLE_ADMIN_ROLE_IDS

    @classmethod
    def is_administrator(cls, role: str) -> bool:
        """Perfis com acesso total."""
        return role.strip().upper() in ADMINISTRATOR_ROLE_IDS
