import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from src.domain.value_objects.email import Email


@dataclass
class User:
    id: uuid.UUID
    email: Email
    full_name: str
    password_hash: str
    is_active: bool = True
    is_superadmin: bool = False
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    phone_number: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_locked(self, now: Optional[datetime] = None) -> bool:
        current_time = now or datetime.now(timezone.utc)
        return self.locked_until is not None and self.locked_until > current_time

    def record_failed_login(self, max_attempts: int, lockout_minutes: int, now: Optional[datetime] = None) -> bool:
        """Incrementa falha de login. Retorna True se a conta foi bloqueada."""
        current_time = now or datetime.now(timezone.utc)
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= max_attempts:
            from datetime import timedelta
            self.locked_until = current_time + timedelta(minutes=lockout_minutes)
            return True
        return False

    def reset_failed_logins(self):
        self.failed_login_attempts = 0
        self.locked_until = None
