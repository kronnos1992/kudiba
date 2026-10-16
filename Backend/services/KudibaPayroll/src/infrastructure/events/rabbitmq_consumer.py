import json
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

try:
    import aio_pika
except ImportError:
    aio_pika = None

logger = logging.getLogger(__name__)

EventHandler = Callable[[str, Dict[str, Any]], Awaitable[None]]


class RabbitMqEventConsumer:
    def __init__(
        self,
        rabbitmq_url: Optional[str],
        exchange_name: str,
        queue_name: str,
        routing_keys: List[str],
        handler: EventHandler,
    ):
        self.rabbitmq_url = rabbitmq_url
        self.exchange_name = exchange_name
        self.queue_name = queue_name
        self.routing_keys = routing_keys
        self.handler = handler
        self._connection: Optional[Any] = None
        self._channel: Optional[Any] = None

    async def start(self) -> bool:
        if not self.rabbitmq_url or aio_pika is None:
            logger.warning("RabbitMQ consumer disabled: connection URL or aio-pika unavailable.")
            return False

        try:
            self._connection = await aio_pika.connect_robust(self.rabbitmq_url)
            self._channel = await self._connection.channel()
            await self._channel.set_qos(prefetch_count=16)
            exchange = await self._channel.declare_exchange(
                self.exchange_name,
                type=aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
            queue = await self._channel.declare_queue(self.queue_name, durable=True)
            for routing_key in self.routing_keys:
                await queue.bind(exchange, routing_key=routing_key)
            await queue.consume(self._on_message)
            logger.info(
                "Attendance consumer bound to '%s' (queue '%s', keys %s).",
                self.exchange_name,
                self.queue_name,
                self.routing_keys,
            )
            return True
        except Exception as exc:
            logger.warning("RabbitMQ consumer failed to start: %s. Running in decoupled mode.", exc)
            self._connection = None
            self._channel = None
            return False

    async def _on_message(self, message: Any) -> None:
        async with message.process(requeue=False):
            try:
                envelope = json.loads(message.body.decode("utf-8"))
            except Exception as exc:
                logger.error("Discarding malformed event on key '%s': %s", message.routing_key, exc)
                return

            try:
                await self.handler(message.routing_key, envelope)
            except Exception as exc:
                logger.error("Failed to process event '%s': %s", message.routing_key, exc)

    async def stop(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
