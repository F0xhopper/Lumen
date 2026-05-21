from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.dependencies import init_db, close_db
from app.api.middleware.cors import add_cors_middleware
from app.api.middleware.error_handlers import add_error_handlers
from app.api.routes import root, query, passages, article, articles, status
from app.repositories.article_repo import ensure_schema

setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = settings.check_required_vars()
    if missing:
        logger.error("Missing required env vars: %s — requests will fail", ", ".join(missing))

    logger.info("Starting Lumen API — connecting to PostgreSQL and Pinecone…")
    await init_db()
    await ensure_schema()
    logger.info("Ready.")
    yield
    await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Lumen API",
        description="Summa Theologica — PostgreSQL + Pinecone hybrid RAG",
        version="2.0.0",
        lifespan=lifespan,
    )

    add_cors_middleware(app)
    add_error_handlers(app)

    app.include_router(root.router)
    app.include_router(query.router)
    app.include_router(passages.router)
    app.include_router(article.router)
    app.include_router(articles.router)
    app.include_router(status.router)

    return app


app = create_app()
