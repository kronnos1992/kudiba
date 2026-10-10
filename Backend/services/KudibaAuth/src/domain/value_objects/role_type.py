from enum import Enum


class RoleType(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    CONTABILISTA = "CONTABILISTA"
    OPERADOR_CAIXA = "OPERADOR_CAIXA"
    GESTOR_STOCK = "GESTOR_STOCK"
    AUDITOR = "AUDITOR"

    @classmethod
    def is_valid(cls, role: str) -> bool:
        try:
            cls(role.upper())
            return True
        except ValueError:
            return False
