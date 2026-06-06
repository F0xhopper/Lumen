import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.infrastructure.database import init_pool, close_pool, get_pool
from app.services.retrieval import init_retrieval
from app.api.middleware.cors import add_cors_middleware
from app.api.middleware.error_handlers import add_error_handlers
from app.api.routes import root, status

# Domain module routers
from app.articles.router import router as articles_router
from app.passages.router import router as passages_router
from app.query.router import router as query_router
from app.bookmarks.router import router as bookmarks_router
from app.history.router import router as history_router
from app.preferences.router import router as preferences_router

# Domain module schema initialisation
from app.articles.repository import ArticleRepository
from app.bookmarks.repository import BookmarkRepository
from app.history.repository import HistoryRepository
from app.preferences.repository import PreferencesRepository

setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = settings.check_required_vars()
    if missing:
        logger.error("Missing required env vars: %s — requests will fail", ", ".join(missing))

    logger.info("Starting Lumen API…")
    await init_pool()

    pool = get_pool()
    await ArticleRepository(pool).ensure_schema()
    await BookmarkRepository(pool).ensure_schema()
    await HistoryRepository(pool).ensure_schema()
    await PreferencesRepository(pool).ensure_schema()

    await asyncio.to_thread(init_retrieval)
    logger.info("Ready.")
    yield
    await close_pool()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Lumen API",
        description="Summa Theologica — PostgreSQL + Pinecone hybrid RAG",
        version="3.0.0",
        lifespan=lifespan,
    )

    add_cors_middleware(app)
    add_error_handlers(app)

    # System
    app.include_router(root.router)
    app.include_router(status.router)

    # Domain modules
    app.include_router(articles_router)
    app.include_router(passages_router)
    app.include_router(query_router)
    app.include_router(bookmarks_router)
    app.include_router(history_router)
    app.include_router(preferences_router)

    return app


app = create_app()
