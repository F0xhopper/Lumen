"""Orchestrates embedding → Pinecone search → cross-encoder reranking."""

import asyncio

from openai import AsyncOpenAI

from app.core.logging import get_logger
from app.models.schemas import PassageResult
from app.repositories.article_repo import ArticleRepository
from app.repositories.pinecone_repo import PineconeMatch, PineconeRepository
from app.services import embedding, reranker, search

logger = get_logger(__name__)

_RERANK_FETCH_MULTIPLIER = 4
_RERANK_FETCH_MAX = 40


def init_retrieval() -> None:
    """Preload BM25 and reranker at startup to avoid first-request latency."""
    search.load_bm25()
    reranker.load_reranker()


def _match_to_passage(match: PineconeMatch, rank: int, score: float) -> PassageResult:
    meta = match.metadata
    return PassageResult(
        rank=rank,
        text=meta.get("text", ""),
        score=round(score, 4),
        part_abbr=meta.get("part_abbr", ""),
        question_n=int(meta.get("question_n", 0)),
        article_n=int(meta.get("article_n", 0)),
        question_title=meta.get("question_title", ""),
        article_title=meta.get("article_title", ""),
        section=meta.get("section", "body"),
        section_label=meta.get("section_label", ""),
        url_fragment=meta.get("url_fragment", ""),
        article_url=meta.get("article_url", ""),
        source_url=meta.get("source_url", ""),
    )


async def hybrid_search(
    query: str,
    client: AsyncOpenAI,
    pinecone_repo: PineconeRepository,
    top_k: int = 8,
    min_score: float = 0.3,
    do_rerank: bool = True,
) -> list[PassageResult]:
    """
    1. Embed query with OpenAI.
    2. Hybrid Pinecone query (dense + sparse BM25); fetch fetch_k candidates.
    3. Cross-encoder reranking (scores normalised to [0, 1] via sigmoid).
    4. Drop results below min_score, return top_k.
    """
    dense = await embedding.embed(query, client)
    fetch_k = min(top_k * _RERANK_FETCH_MULTIPLIER, _RERANK_FETCH_MAX)
    candidates = await search.pinecone_hybrid_search(query, dense, pinecone_repo, fetch_k)

    if not candidates:
        return []

    scores: list[float] | None = None
    if do_rerank:
        scores = await reranker.rerank(query, [m.text for m in candidates])

    if scores is not None:
        ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    else:
        ranked = [(m, m.score) for m in candidates]

    results = []
    for rank, (match, score) in enumerate(ranked[:top_k], 1):
        if scores is not None and score < min_score:
            break
        results.append(_match_to_passage(match, rank, float(score)))
    return results


async def combined_search(
    query: str,
    client: AsyncOpenAI,
    article_repo: ArticleRepository,
    pinecone_repo: PineconeRepository,
    top_k: int = 8,
    min_score: float = 0.3,
    do_rerank: bool = True,
) -> list[PassageResult]:
    """Parallel FTS + semantic search; reranks both legs on a shared scale."""
    exact_passages, semantic = await asyncio.gather(
        article_repo.fts_search(query, limit=top_k),
        hybrid_search(
            query, client, pinecone_repo,
            top_k=top_k, min_score=min_score, do_rerank=do_rerank,
        ),
    )

    if exact_passages:
        texts = [p.text for p in exact_passages]
        rr_scores = await reranker.rerank(query, texts) if do_rerank else None
        if rr_scores is not None:
            exact_passages = [
                p.model_copy(update={"score": round(float(s), 4)})
                for p, s in zip(exact_passages, rr_scores)
            ]
        else:
            exact_passages = [p.model_copy(update={"score": 0.85}) for p in exact_passages]

    exact_passages = [p for p in exact_passages if p.score >= min_score]

    exact_keys = {(p.part_abbr, p.question_n, p.article_n, p.section) for p in exact_passages}
    merged = exact_passages + [
        p for p in semantic
        if (p.part_abbr, p.question_n, p.article_n, p.section) not in exact_keys
    ]
    merged.sort(key=lambda p: p.score, reverse=True)

    return [
        p.model_copy(update={"rank": i})
        for i, p in enumerate(merged[:top_k], 1)
    ]
