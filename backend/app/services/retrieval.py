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
    alpha: float = 0.7,
    min_score: float = 0.3,
    do_rerank: bool = True,
) -> list[PassageResult]:
    dense = await embedding.embed(query, client)
    fetch_k = min(top_k * _RERANK_FETCH_MULTIPLIER, _RERANK_FETCH_MAX)
    candidates = await search.pinecone_hybrid_search(query, dense, pinecone_repo, fetch_k, alpha=alpha)

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
    dense = await embedding.embed(query, client)
    fetch_k = min(top_k * _RERANK_FETCH_MULTIPLIER, _RERANK_FETCH_MAX)

    exact_passages, pinecone_matches = await asyncio.gather(
        article_repo.fts_search(query, limit=top_k),
        search.pinecone_hybrid_search(query, dense, pinecone_repo, fetch_k),
    )

    exact_keys = {(p.part_abbr, p.question_n, p.article_n, p.section) for p in exact_passages}
    unique_pinecone = [
        m for m in pinecone_matches
        if (m.metadata.get("part_abbr"), int(m.metadata.get("question_n", 0)),
            int(m.metadata.get("article_n", 0)), m.metadata.get("section", "body")) not in exact_keys
    ]

    all_texts = [p.text for p in exact_passages] + [m.text for m in unique_pinecone]

    if do_rerank and all_texts:
        scores = await reranker.rerank(query, all_texts)
    else:
        scores = None

    results: list[PassageResult] = []
    if scores is not None:
        fts_scores = scores[: len(exact_passages)]
        pine_scores = scores[len(exact_passages):]
        exact_passages = [
            p.model_copy(update={"score": round(float(s), 4)})
            for p, s in zip(exact_passages, fts_scores)
        ]
        results = exact_passages + [
            _match_to_passage(m, 0, s)
            for m, s in zip(unique_pinecone, pine_scores)
        ]
    else:
        exact_passages = [p.model_copy(update={"score": 0.85}) for p in exact_passages]
        results = exact_passages + [
            _match_to_passage(m, 0, m.score) for m in unique_pinecone
        ]

    results = [r for r in results if r.score >= min_score]
    results.sort(key=lambda r: r.score, reverse=True)
    return [r.model_copy(update={"rank": i}) for i, r in enumerate(results[:top_k], 1)]
