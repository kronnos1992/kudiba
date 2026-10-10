from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from src.domain.entities.user import User


@dataclass(frozen=True)
class AccountSecurityPolicy:
    max_login_attempts: int = 5
    lockout_minutes: int = 15

    def check_and_apply_failure(self, user: User, now: Optional[datetime] = None) -> bool:
        """Aplica a regra de falha de login. Retorna True se a conta foi bloqueada."""
        return user.record_failed_login(
            max_attempts=self.max_login_attempts,
            lockout_minutes=self.lockout_minutes,
            now=now or datetime.now(timezone.utc),
        )

    def is_locked(self, user: User, now: Optional[datetime] = None) -> bool:
        return user.is_locked(now or datetime.now(timezone.utc))

    def minutes_remaining(self, user: User, now: Optional[datetime] = None) -> int:
        current_time = now or datetime.now(timezone.utc)
        if not user.locked_until or user.locked_until <= current_time:
            return 0
        return int((user.locked_until - current_time).total_seconds() / 60) + 1
