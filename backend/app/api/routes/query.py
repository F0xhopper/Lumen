from fastapi import APIRouter, HTTPException

from app.models.schemas import QueryRequest, QueryResponse
from app.services.retrieval import hybrid_search
from app.services.answer import generate_answer
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    try:
        passages = await hybrid_search(req.query, top_k=8)
        answer = await generate_answer(req.query, passages)
        return QueryResponse(answer=answer, passages_used=len(passages))
    except Exception as e:
        logger.error("Error in POST /query: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
