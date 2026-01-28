"""FastAPI dependency injection setup."""

from functools import lru_cache
from app.services.rag_service import RAGService

rag_service_instance = None


@lru_cache()
def get_rag_service() -> RAGService:
    """Get or create the RAG service instance."""
    global rag_service_instance
    if rag_service_instance is None:
        rag_service_instance = RAGService()
    return rag_service_instance