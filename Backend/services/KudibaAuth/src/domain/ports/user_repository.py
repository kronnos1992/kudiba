import uuid
from abc import ABC, abstractmethod
from typing import Optional
from src.domain.entities.user import User


class IUserRepository(ABC):
    @abstractmethod
    async def find_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        pass

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    async def save(self, user: User) -> None:
        pass

    @abstractmethod
    async def update_login_state(self, user: User) -> None:
        pass
