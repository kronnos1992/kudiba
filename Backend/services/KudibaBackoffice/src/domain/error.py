class DomainError(Exception):
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class UnauthorizedError(DomainError):
    def __init__(self, message: str = "Autenticação necessária. Efectue login."):
        super().__init__(message, code="UNAUTHORIZED")


class ForbiddenError(DomainError):
    def __init__(self, message: str = "Acesso restrito à administração da plataforma Kudiba."):
        super().__init__(message, code="FORBIDDEN")


class EntityNotFoundError(DomainError):
    def __init__(self, entity_name: str, identifier: str):
        super().__init__(f"{entity_name} '{identifier}' não encontrado(a).", code="NOT_FOUND")


class ConflictError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="CONFLICT")


class InvalidModulesError(DomainError):
    def __init__(self, message: str = "A lista de módulos é inválida ou contém módulos desconhecidos."):
        super().__init__(message, code="INVALID_MODULES")


class RenewalImpossibleError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="RENEWAL_IMPOSSIBLE")
