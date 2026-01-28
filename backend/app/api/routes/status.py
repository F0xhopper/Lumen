"""Status endpoints for system health checks."""

from fastapi import APIRouter, Depends

from app.models.responses import StatusResponse
from app.core.dependencies import get_rag_service

router = APIRouter()


@router.get("/status", response_model=StatusResponse)
async def get_system_status(rag_service = Depends(get_rag_service)):
    """
    Get the current status of the RAG system.
    
    This endpoint provides information about whether the system is ready
    to process queries and the state of the vector index.
    """
    if rag_service.index is None or rag_service.query_engine is None:
        try:
            rag_service.ensure_ready_for_queries()
        except Exception:
            pass
    
    index_exists = rag_service.index is not None
    query_engine_ready = rag_service.query_engine is not None
    
    if not index_exists:
        status_message = "RAG system initialized but no documents uploaded yet"
    elif not query_engine_ready:
        status_message = "Index exists but query engine not ready"
    else:
        status_message = "System ready for queries"
    
    return StatusResponse(
        rag_system_initialized=True,
        index_exists=index_exists,
        query_engine_ready=query_engine_ready,
        status_message=status_message
    )