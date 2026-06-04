import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    ssl = "require" if settings.DATABASE_SSL else None
    _pool = await asyncpg.create_pool(
        settings.DATABASE_URL, min_size=2, max_size=10, ssl=ssl
    )


async def close_pool() -> None:
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised — server is still starting up.")
    return _pool
