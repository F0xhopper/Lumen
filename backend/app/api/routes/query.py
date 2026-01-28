"""Query endpoints for the RAG system."""

from fastapi import APIRouter, HTTPException, Depends

from app.models.requests import QueryRequest
from app.models.responses import QueryResponse
from app.core.dependencies import get_rag_service
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_aquinas(
    request: QueryRequest,
    rag_service = Depends(get_rag_service)
):
    """
    Query the Aquinas RAG system with a question.
    
    This endpoint allows you to ask questions about St. Thomas Aquinas's works
    and get comprehensive answers based on the indexed documents.
    """
    if not rag_service.query_engine:
        try:
            rag_service.ensure_ready_for_queries()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Query engine not ready: {str(e)}")
    
    try:
        answer = rag_service.query(
            question=request.query,
            context_length=request.context_length
        )
        
        return QueryResponse(
            answer=answer,
            context_length=request.context_length
        )
        
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")