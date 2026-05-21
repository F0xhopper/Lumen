"""Hybrid search: dense + sparse Pinecone query, cross-encoder reranking."""

import asyncio
from pathlib import Path

from openai import AsyncOpenAI
from pinecone_text.sparse import BM25Encoder

from app.core.config import settings
from app.core.dependencies import get_openai, get_pinecone_index
from app.core.logging import get_logger

logger = get_logger(__name__)

BM25_PARAMS_PATH = Path(__file__).parent.parent.parent / "data" / "bm25_params.json"

_PART_TO_SLUG = {
    "prima-pars": "1",
    "prima-secundae": "1-2",
    "secunda-secundae": "2-2",
    "tertia-pars": "3",
}

_RERANK_FETCH_MULTIPLIER = 4
_RERANK_FETCH_MAX = 40

_bm25 = None
_ranker = None


def _load_bm25():
    global _bm25
    if _bm25 is not None:
        return _bm25
    if not BM25_PARAMS_PATH.exists():
        logger.warning(
            "BM25 params not found — sparse search disabled. Run scripts/index_summa.py first."
        )
        return None
    _bm25 = BM25Encoder()
    _bm25.load(str(BM25_PARAMS_PATH))
    return _bm25


def _load_ranker():
    global _ranker
    if _ranker is not None:
        return _ranker
    try:
        from sentence_transformers import CrossEncoder

        model = settings.RERANKER_MODEL
        logger.info("Loading reranker (%s)…", model)
        _ranker = CrossEncoder(model, max_length=512)
        logger.info("Reranker loaded.")
    except Exception as e:
        logger.warning(
            "Could not load reranker (%s) — results will use Pinecone order.", e
        )
        _ranker = None
    return _ranker


def init_retrieval() -> None:
    """Preload BM25 and reranker at startup to avoid first-request latency."""
    _load_bm25()
    _load_ranker()


async def embed(text: str) -> list[float]:
    client: AsyncOpenAI = get_openai()
    resp = await client.embeddings.create(model=settings.EMBED_MODEL, input=text)
    return resp.data[0].embedding


def _rerank_sync(ranker, query: str, candidates: list) -> list[tuple]:
    """Score (query, passage) pairs; sigmoid normalises logits to [0, 1]."""
    import numpy as np

    pairs = [[query, (m.metadata or {}).get("text", "")[:2048]] for m in candidates]
    logits = ranker.predict(pairs)
    scores = (1.0 / (1.0 + np.exp(-logits))).tolist()
    return sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)


async def _rerank_dicts(ranker, query: str, passages: list[dict]) -> list[dict]:
    """Score a list of passage dicts in-place with the cross-encoder."""
    import numpy as np

    pairs = [[query, p["text"][:2048]] for p in passages]
    logits = await asyncio.to_thread(ranker.predict, pairs)
    scores = (1.0 / (1.0 + np.exp(-logits))).tolist()
    for p, score in zip(passages, scores):
        p["score"] = round(float(score), 4)
    return passages


async def hybrid_search(
    query: str,
    top_k: int = 8,
    min_score: float = 0.3,
    rerank: bool = True,
) -> list[dict]:
    """
    1. Single hybrid Pinecone query (dense + sparse, alpha=0.7) fetches fetch_k candidates.
       The index is dense-type and does not accept sparse-only queries, so true RRF
       (two independent legs) is not possible — Pinecone handles the fusion internally.
    2. ms-marco-MiniLM-L-6-v2 rescores the candidate pool (scores normalised to [0, 1]).
    3. Results below min_score are dropped; top_k returned.
    """
    dense = await embed(query)
    index = get_pinecone_index()
    bm25 = _load_bm25()

    fetch_k = min(top_k * _RERANK_FETCH_MULTIPLIER, _RERANK_FETCH_MAX)
    base_kwargs = {
        "namespace": settings.PINECONE_NAMESPACE,
        "top_k": fetch_k,
        "include_metadata": True,
    }

    if bm25 is not None:
        sparse = bm25.encode_queries(query)
        result = await asyncio.to_thread(
            index.query,
            vector=[v * 0.7 for v in dense],
            sparse_vector={
                "indices": sparse["indices"],
                "values": [v * 0.3 for v in sparse["values"]],
            },
            **base_kwargs,
        )
    else:
        result = await asyncio.to_thread(index.query, vector=dense, **base_kwargs)

    candidates = result.matches

    if not candidates:
        return []

    ranker = _load_ranker() if rerank else None
    if ranker is not None:
        try:
            ranked = await asyncio.to_thread(_rerank_sync, ranker, query, candidates)
        except Exception as e:
            logger.warning("Reranking failed (%s) — using Pinecone order.", e)
            ranked = [(m, None) for m in candidates]
    else:
        ranked = [(m, None) for m in candidates]

    passages = []
    for rank, (match, score) in enumerate(ranked[:top_k], 1):
        if score is not None and score < min_score:
            break  # sorted descending — nothing below will pass
        meta = match.metadata or {}
        passages.append(
            {
                "rank": rank,
                "text": meta.get("text", ""),
                "score": round(float(score), 4) if score is not None else 0.0,
                "part_abbr": meta.get("part_abbr", ""),
                "question_n": int(meta.get("question_n", 0)),
                "article_n": int(meta.get("article_n", 0)),
                "question_title": meta.get("question_title", ""),
                "article_title": meta.get("article_title", ""),
                "section": meta.get("section", "body"),
                "section_label": meta.get("section_label", ""),
                "url_fragment": meta.get("url_fragment", ""),
                "article_url": meta.get("article_url", ""),
                "source_url": meta.get("source_url", ""),
            }
        )
    return passages


async def combined_search(
    query: str,
    top_k: int = 8,
    min_score: float = 0.3,
    rerank: bool = True,
) -> list[dict]:
    from app.repositories.article_repo import ilike_search

    exact_raw, semantic = await asyncio.gather(
        ilike_search(query, limit=top_k),
        hybrid_search(query, top_k=top_k, min_score=min_score, rerank=rerank),
    )

    exact = []
    for r in exact_raw:
        slug = _PART_TO_SLUG.get(r["part_id"], r["part_id"])
        exact.append(
            {
                "rank": 0,
                "text": r["text"] or "",
                "score": 0.0,
                "part_abbr": r["part_abbr"],
                "question_n": r["question_n"],
                "article_n": r["article_n"],
                "question_title": r["question_title"],
                "article_title": r["article_title"],
                "section": r["section"],
                "section_label": r["section_label"],
                "url_fragment": r["url_fragment"],
                "article_url": f"/{slug}/{r['question_n']}/{r['article_n']}",
                "source_url": r["source_url"],
            }
        )

    # Rerank exact matches with the same cross-encoder so their scores are
    # comparable to the semantic results and can be sorted together fairly.
    if exact:
        ranker = _load_ranker() if rerank else None
        if ranker is not None:
            try:
                exact = await _rerank_dicts(ranker, query, exact)
            except Exception as e:
                logger.warning("Exact-match reranking failed (%s) — using default score.", e)
                for r in exact:
                    r["score"] = 0.85
        else:
            for r in exact:
                r["score"] = 0.85

    exact_keys = {
        (r["part_abbr"], r["question_n"], r["article_n"], r["section"]) for r in exact
    }
    merged = exact + [
        r
        for r in semantic
        if (r["part_abbr"], r["question_n"], r["article_n"], r["section"])
        not in exact_keys
    ]
    merged.sort(key=lambda r: r["score"], reverse=True)

    for i, r in enumerate(merged[:top_k], 1):
        r["rank"] = i

    return merged[:top_k]
