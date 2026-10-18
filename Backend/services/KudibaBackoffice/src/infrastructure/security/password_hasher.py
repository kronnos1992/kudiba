from argon2 import PasswordHasher


class Argon2PasswordHasher:
    def __init__(self):
        self._hasher = PasswordHasher()

    def hash(self, plain: str) -> str:
        return self._hasher.hash(plain)

    def verify(self, password_hash: str, plain: str) -> bool:
        try:
            return self._hasher.verify(password_hash, plain)
        except Exception:
            return False
