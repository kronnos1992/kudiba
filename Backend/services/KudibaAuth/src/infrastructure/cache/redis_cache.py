import asyncio
from typing import Optional
import redis.asyncio as aioredis
from src.domain.ports.cache_service import ICacheService


class RedisCacheService(ICacheService):
    """Adaptador concreto para Redis implementando ICacheService."""
    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._client: Optional[aioredis.Redis] = None
        self._client_lock = asyncio.Lock()

    async def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            async with self._client_lock:
                if self._client is None:
                    self._client = aioredis.from_url(
                        self._redis_url,
                        decode_responses=True,
                        socket_timeout=5.0,
                        socket_connect_timeout=5.0,
                    )
        return self._client

    async def blacklist_token(self, jti: str, ttl_seconds: int) -> None:
        if not jti or ttl_seconds <= 0:
            return
        client = await self._get_client()
        key = f"jwt:blacklist:{jti}"
        await client.set(key, "1", ex=ttl_seconds)

    async def is_token_blacklisted(self, jti: str) -> bool:
        if not jti:
            return False
        client = await self._get_client()
        key = f"jwt:blacklist:{jti}"
        return bool(await client.exists(key))

    async def revoke_sessions_before(self, user_id: str, tenant_id: str, epoch: int, ttl_seconds: int) -> None:
        if not user_id or not tenant_id or ttl_seconds <= 0:
            return
        client = await self._get_client()
        key = f"jwt:revoked-before:{user_id}:{tenant_id}"
        await client.set(key, str(epoch), ex=ttl_seconds)

    async def get_revoked_before(self, user_id: str, tenant_id: str) -> int:
        if not user_id or not tenant_id:
            return 0
        client = await self._get_client()
        key = f"jwt:revoked-before:{user_id}:{tenant_id}"
        value = await client.get(key)
        if not value:
            return 0
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    async def ping(self) -> bool:
        client = await self._get_client()
        return bool(await client.ping())

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
