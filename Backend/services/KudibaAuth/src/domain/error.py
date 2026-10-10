"""Erros tipados da camada de domínio do KudibaAuth."""

class DomainError(Exception):
    """Erro base para exceções de domínio."""
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class InvalidCredentialsError(DomainError):
    def __init__(self, message: str = "Credenciais inválidas. Verifique o seu e-mail e palavra-passe."):
        super().__init__(message, code="INVALID_CREDENTIALS")


class AccountLockedError(DomainError):
    def __init__(self, minutes_remaining: int):
        super().__init__(
            f"Conta temporariamente bloqueada por excesso de tentativas falhadas. Tente novamente em {minutes_remaining} minutos.",
            code="ACCOUNT_LOCKED",
        )
        self.minutes_remaining = minutes_remaining


class AccountInactiveError(DomainError):
    def __init__(self, message: str = "A sua conta de utilizador encontra-se desactivada. Contacte o administrador."):
        super().__init__(message, code="ACCOUNT_INACTIVE")


class TenantAccessForbiddenError(DomainError):
    def __init__(self, message: str = "O utilizador não tem permissão para aceder à organização solicitada."):
        super().__init__(message, code="TENANT_ACCESS_FORBIDDEN")


class TokenReusedError(DomainError):
    def __init__(self, message: str = "Alerta de segurança: violação de integridade de sessão detectada. Todas as sessões foram revogadas."):
        super().__init__(message, code="TOKEN_REUSE_DETECTED")


class SessionExpiredError(DomainError):
    def __init__(self, message: str = "A sua sessão expirou. Efectue novo login."):
        super().__init__(message, code="SESSION_EXPIRED")


class EntityNotFoundError(DomainError):
    def __init__(self, entity_name: str, identifier: str):
        super().__init__(f"{entity_name} '{identifier}' não encontrado(a).", code="NOT_FOUND")


class ConflictError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="CONFLICT")


class AuthorizationError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="FORBIDDEN")
