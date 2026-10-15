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


class PeriodClosedError(DomainError):
    def __init__(self, message: str = "O período de processamento salarial já se encontra encerrado."):
        super().__init__(message, code="PERIOD_CLOSED")


class ContractNotActiveError(DomainError):
    def __init__(self, message: str = "O contrato do colaborador não se encontra ativo."):
        super().__init__(message, code="CONTRACT_NOT_ACTIVE")
