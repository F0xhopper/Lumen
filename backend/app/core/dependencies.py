"""Shared client singletons — created once at lifespan startup, exposed as FastAPI dependencies."""

import asyncpg
from openai import AsyncOpenAI
from pinecone import Pinecone

from app.core.config import settings

_db_pool: asyncpg.Pool | None = None
_openai: AsyncOpenAI | None = None
_pinecone_index = None


async def init_db():
    global _db_pool
    ssl = "require" if settings.DATABASE_SSL else None
    _db_pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=2, max_size=10, ssl=ssl)


async def close_db():
    if _db_pool:
        await _db_pool.close()


def get_db_pool() -> asyncpg.Pool:
    if _db_pool is None:
        raise RuntimeError("Database pool not initialised — server is starting up or failed to start.")
    return _db_pool


def get_openai() -> AsyncOpenAI:
    global _openai
    if _openai is None:
        _openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai


def get_pinecone_index():
    global _pinecone_index
    if _pinecone_index is None:
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        _pinecone_index = pc.Index(settings.PINECONE_INDEX_NAME)
    return _pinecone_index


# --- FastAPI dependency providers ---

def get_article_repo():
    from app.repositories.article_repo import ArticleRepository
    return ArticleRepository(get_db_pool())


def get_pinecone_repo():
    from app.repositories.pinecone_repo import PineconeRepository
    return PineconeRepository(get_pinecone_index())
