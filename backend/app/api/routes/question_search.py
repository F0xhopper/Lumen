from fastapi import APIRouter, Depends, HTTPException, Query
from openai import AsyncOpenAI

from app.core.dependencies import get_openai, get_pinecone_repo
from app.core.logging import get_logger
from app.models.schemas import QuestionResult
from app.repositories.pinecone_repo import PineconeRepository
from app.services import embedding

logger = get_logger(__name__)
router = APIRouter()

QUESTIONS_NAMESPACE = "questions"


@router.get("/question-search", response_model=list[QuestionResult])
async def question_search(
    q: str = Query(..., min_length=1, max_length=500),
    top_k: int = Query(5, ge=1, le=20),
    min_score: float = Query(0.5, ge=0.0, le=1.0),
    client: AsyncOpenAI = Depends(get_openai),
    pinecone_repo: PineconeRepository = Depends(get_pinecone_repo),
):
    try:
        dense = await embedding.embed(q, client)
        candidates = await pinecone_repo.hybrid_query(
            dense_vector=dense,
            sparse_vector=None,
            top_k=top_k * 2,
            namespace=QUESTIONS_NAMESPACE,
        )
        results = []
        for rank, match in enumerate(candidates, 1):
            if match.score < min_score:
                break
            meta = match.metadata
            results.append(QuestionResult(
                rank=rank,
                score=round(match.score, 4),
                part_id=meta.get("part_id", ""),
                part_abbr=meta.get("part_abbr", ""),
                question_n=int(meta.get("question_n", 0)),
                question_title=meta.get("question_title", ""),
            ))
            if len(results) >= top_k:
                break
        return results
    except Exception as e:
        logger.error("Error in GET /question-search: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
