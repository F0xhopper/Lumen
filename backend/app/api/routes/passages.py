from fastapi import APIRouter, Query, HTTPException

from app.services.retrieval import hybrid_search
from app.models.schemas import PassageResult
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/passages", response_model=list[PassageResult])
async def get_passages(
    query: str = Query(..., min_length=1),
    top_k: int = Query(8, ge=1, le=20),
    alpha: float = Query(0.7, ge=0.0, le=1.0),
):
    try:
        return await hybrid_search(query, top_k=top_k, alpha=alpha)
    except Exception as e:
        logger.error("Error in GET /passages: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
