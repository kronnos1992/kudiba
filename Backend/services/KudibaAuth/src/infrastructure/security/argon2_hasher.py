from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from src.domain.ports.password_hasher import IPasswordHasher


class Argon2PasswordHasher(IPasswordHasher):
    """Implementação concreta de IPasswordHasher via biblioteca Argon2id."""
    def __init__(self):
        self._ph = PasswordHasher(
            time_cost=3,
            memory_cost=65536,  # 64 MB
            parallelism=4,
            hash_len=32,
            salt_len=16,
        )

    def hash(self, password: str) -> str:
        return self._ph.hash(password)

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        try:
            return self._ph.verify(hashed_password, plain_password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False
