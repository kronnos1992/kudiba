class DomainError(Exception):
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class EntityNotFoundError(DomainError):
    def __init__(self, entity_name: str, identifier: str):
        super().__init__(f"{entity_name} '{identifier}' não encontrado(a).", code="NOT_FOUND")


class ConflictError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="CONFLICT")


class ValidationError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR")


class IntegrationDisabledError(DomainError):
    def __init__(self, message: str = "A integração encontra-se desativada."):
        super().__init__(message, code="INTEGRATION_DISABLED")
