from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI

from app.core.dependencies import get_openai, get_pinecone_repo
from app.core.logging import get_logger
from app.models.schemas import QueryRequest, QueryResponse
from app.repositories.pinecone_repo import PineconeRepository
from app.services.answer import generate_answer
from app.services.retrieval import hybrid_search

logger = get_logger(__name__)
router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query(
    req: QueryRequest,
    client: AsyncOpenAI = Depends(get_openai),
    pinecone_repo: PineconeRepository = Depends(get_pinecone_repo),
):
    try:
        passages = await hybrid_search(req.query, client=client, pinecone_repo=pinecone_repo, top_k=8)
        answer = await generate_answer(req.query, passages, client)
        return QueryResponse(answer=answer, passages_used=len(passages))
    except Exception as e:
        logger.error("Error in POST /query: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
