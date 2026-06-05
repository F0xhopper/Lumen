from fastapi import APIRouter, Depends, HTTPException, Query
from openai import AsyncOpenAI, APIConnectionError as OpenAIConnectionError, RateLimitError

from app.articles.repository import ArticleRepository
from app.core.logging import get_logger
from app.infrastructure.database import get_pool
from app.infrastructure.openai import get_openai_client
from app.infrastructure.pinecone import get_pinecone_index
from app.passages.repository import PineconeRepository
from app.passages.schemas import PassageResult, QuestionResult
from app.passages.service import PassageSearchService, QuestionSearchService

logger = get_logger(__name__)
router = APIRouter(prefix="/passages", tags=["passages"])


def _get_passage_service(
    pool=Depends(get_pool),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
    pinecone_index=Depends(get_pinecone_index),
) -> PassageSearchService:
    return PassageSearchService(
        article_repo=ArticleRepository(pool),
        pinecone_repo=PineconeRepository(pinecone_index),
        openai_client=openai_client,
    )


def _get_question_service(
    openai_client: AsyncOpenAI = Depends(get_openai_client),
    pinecone_index=Depends(get_pinecone_index),
) -> QuestionSearchService:
    return QuestionSearchService(
        pinecone_repo=PineconeRepository(pinecone_index),
        openai_client=openai_client,
    )


@router.get("/", response_model=list[PassageResult])
async def search_passages(
    query: str = Query(..., min_length=1, max_length=500),
    top_k: int = Query(8, ge=1, le=20),
    min_score: float = Query(0.3, ge=0.0, le=1.0),
    svc: PassageSearchService = Depends(_get_passage_service),
):
    try:
        return await svc.search(query, top_k=top_k, min_score=min_score)
    except RateLimitError as exc:
        logger.error("OpenAI rate limit in passage search: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit reached. Please try again shortly.")
    except OpenAIConnectionError as exc:
        logger.error("OpenAI connection error in passage search: %s", exc)
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable. Please try again.")
    except Exception as exc:
        logger.error("Passage search failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/questions", response_model=list[QuestionResult])
async def search_questions(
    q: str = Query(..., min_length=1, max_length=500),
    top_k: int = Query(5, ge=1, le=20),
    min_score: float = Query(0.5, ge=0.0, le=1.0),
    svc: QuestionSearchService = Depends(_get_question_service),
):
    try:
        return await svc.search(q, top_k=top_k, min_score=min_score)
    except RateLimitError as exc:
        logger.error("OpenAI rate limit in question search: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit reached. Please try again shortly.")
    except OpenAIConnectionError as exc:
        logger.error("OpenAI connection error in question search: %s", exc)
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable. Please try again.")
    except Exception as exc:
        logger.error("Question search failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
