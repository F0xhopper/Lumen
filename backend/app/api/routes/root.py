"""Root endpoints for API information."""

from typing import Dict
from fastapi import APIRouter

router = APIRouter()


@router.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Aquinas RAG API",
        "description": "Sophisticated RAG system for St. Thomas Aquinas works using Pinecone, OpenAI, and LlamaCloud",
        "version": "1.0.0",
        "configuration": {
            "vector_store": "Pinecone",
            "llm_provider": "OpenAI GPT-4o",
            "embedding_provider": "OpenAI text-embedding-3-large",
            "parsing": "LlamaCloud"
        },
        "endpoints": {
            "query": "/query",
            "upload": "/upload",
            "passages": "/passages",
            "status": "/status",
            "docs": "/docs"
        }
    }