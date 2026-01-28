"""
FastAPI Application for Aquinas RAG System
==========================================

This FastAPI application provides endpoints for querying and uploading documents
to the sophisticated Aquinas RAG system using LlamaIndex.
"""

import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
import uvicorn

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.dependencies import get_rag_service
from app.api.middleware.cors import add_cors_middleware
from app.api.middleware.error_handlers import add_error_handlers
from app.api.routes import root, query, upload, passages, status

setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - initialize and cleanup resources."""
    
    try:
        logger.info("Initializing Aquinas RAG system with Pinecone + OpenAI + LlamaCloud...")
        rag_service = get_rag_service()
        
        try:
            rag_service.ensure_ready_for_queries()
            logger.info("RAG system query engine ready on startup")
        except Exception as e:
            logger.warning(f"RAG system initialized, but query engine not ready yet: {e}")
        logger.info("Aquinas RAG system initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize RAG system: {e}")
        raise
    
    yield
    
    logger.info("Shutting down Aquinas RAG system...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title="Aquinas RAG API",
        description="Sophisticated RAG system for St. Thomas Aquinas works using Pinecone, OpenAI, and LlamaCloud",
        version="1.0.0",
        lifespan=lifespan
    )
    
    add_cors_middleware(app)
    add_error_handlers(app)
    
    app.include_router(root.router)
    app.include_router(query.router)
    app.include_router(upload.router)
    app.include_router(passages.router)
    app.include_router(status.router)
    
    return app


def check_environment():
    """Check if required environment variables are set."""
    required_vars = settings.check_required_vars()
    
    if required_vars:
        print("❌ Missing required environment variables:")
        for var in required_vars:
            print(f"   - {var}")
        print("\nPlease set these variables in your .env file or environment.")
        print("See .env.example for reference.")
        return False
    
    return True


def main():
    """Main function to start the Aquinas RAG API server."""
    
    if not check_environment():
        sys.exit(1)
    
    print("🏛️  Aquinas RAG API")
    print("=" * 50)
    print(f"Host: {settings.HOST}")
    print(f"Port: {settings.PORT}")
    print(f"Log Level: {settings.LOG_LEVEL}")
    print("=" * 50)
    
    print(f"LLM Provider: {settings.LLM_PROVIDER}")
    print(f"Embedding Provider: {settings.EMBEDDING_PROVIDER}")
    print(f"Vector Store: {settings.VECTOR_STORE}")
    print("=" * 50)
    
    app = create_app()
    
    try:
        logger.info("Starting Aquinas RAG API server...")
        uvicorn.run(
            app,
            host=settings.HOST,
            port=settings.PORT,
            log_level=settings.LOG_LEVEL.lower(),
            access_log=True
        )
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)


app = create_app()


if __name__ == "__main__":
    main()