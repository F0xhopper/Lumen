from fastapi import APIRouter, Depends, HTTPException, Query
from openai import AsyncOpenAI

from app.core.dependencies import get_article_repo, get_openai, get_pinecone_repo
from app.core.logging import get_logger
from app.models.schemas import PassageResult
from app.repositories.article_repo import ArticleRepository
from app.repositories.pinecone_repo import PineconeRepository
from app.services.retrieval import combined_search

logger = get_logger(__name__)
router = APIRouter()


@router.get("/passages", response_model=list[PassageResult])
async def get_passages(
    query: str = Query(..., min_length=1, max_length=500),
    top_k: int = Query(8, ge=1, le=20),
    min_score: float = Query(0.3, ge=0.0, le=1.0),
    client: AsyncOpenAI = Depends(get_openai),
    article_repo: ArticleRepository = Depends(get_article_repo),
    pinecone_repo: PineconeRepository = Depends(get_pinecone_repo),
):
    try:
        return await combined_search(
            query,
            client=client,
            article_repo=article_repo,
            pinecone_repo=pinecone_repo,
            top_k=top_k,
            min_score=min_score,
        )
    except Exception as e:
        logger.error("Error in GET /passages: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
