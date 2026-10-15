from abc import ABC, abstractmethod
from typing import Any, Dict


class EventPublisher(ABC):
    @abstractmethod
    async def publish(self, routing_key: str, payload: Dict[str, Any]) -> None:
        pass
