import json
import logging
from typing import Any, Dict, Optional
try:
    import aio_pika
except ImportError:
    aio_pika = None

from src.domain.ports.event_publisher import EventPublisher

logger = logging.getLogger(__name__)


class RabbitMqEventPublisher(EventPublisher):
    def __init__(self, rabbitmq_url: Optional[str] = None, exchange_name: str = "fiscal.events"):
        self.rabbitmq_url = rabbitmq_url
        self.exchange_name = exchange_name
        self._connection: Optional[Any] = None
        self._channel: Optional[Any] = None
        self._exchange: Optional[Any] = None

    async def _ensure_connection(self) -> bool:
        if not self.rabbitmq_url or aio_pika is None:
            return False
        if self._connection and not self._connection.is_closed:
            return True

        try:
            self._connection = await aio_pika.connect_robust(self.rabbitmq_url)
            self._channel = await self._connection.channel()
            self._exchange = await self._channel.declare_exchange(
                self.exchange_name,
                type=aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
            return True
        except Exception as exc:
            logger.warning(f"RabbitMQ connection failed: {exc}. Payroll will run in decoupled mode.")
            return False

    async def publish(self, routing_key: str, payload: Dict[str, Any]) -> None:
        if not await self._ensure_connection() or not self._exchange:
            logger.info(f"Mocking event publication [{routing_key}]: {payload.get('event_type')}")
            return

        try:
            body = json.dumps(payload, default=str).encode("utf-8")
            message = aio_pika.Message(
                body=body,
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            )
            await self._exchange.publish(message, routing_key=routing_key)
            logger.info(f"Event published successfully to '{self.exchange_name}' with key '{routing_key}'.")
        except Exception as exc:
            logger.error(f"Failed to publish event to RabbitMQ: {exc}")

    async def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
