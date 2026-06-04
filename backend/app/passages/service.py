from openai import AsyncOpenAI

from app.articles.repository import ArticleRepository
from app.passages.repository import PineconeRepository
from app.passages.schemas import PassageResult, QuestionResult
from app.services import embedding
from app.services.retrieval import combined_search

_QUESTIONS_NAMESPACE = "questions"


class PassageSearchService:
    def __init__(
        self,
        article_repo: ArticleRepository,
        pinecone_repo: PineconeRepository,
        openai_client: AsyncOpenAI,
    ) -> None:
        self._article_repo = article_repo
        self._pinecone_repo = pinecone_repo
        self._client = openai_client

    async def search(
        self,
        query: str,
        top_k: int = 8,
        min_score: float = 0.3,
    ) -> list[PassageResult]:
        return await combined_search(
            query,
            client=self._client,
            article_repo=self._article_repo,
            pinecone_repo=self._pinecone_repo,
            top_k=top_k,
            min_score=min_score,
        )


class QuestionSearchService:
    def __init__(self, pinecone_repo: PineconeRepository, openai_client: AsyncOpenAI) -> None:
        self._pinecone_repo = pinecone_repo
        self._client = openai_client

    async def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.5,
    ) -> list[QuestionResult]:
        dense = await embedding.embed(query, self._client)
        candidates = await self._pinecone_repo.hybrid_query(
            dense_vector=dense,
            sparse_vector=None,
            top_k=top_k * 2,
            namespace=_QUESTIONS_NAMESPACE,
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
