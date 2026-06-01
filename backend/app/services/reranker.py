import asyncio

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_MIN_CANDIDATES = 5

_pc = None       # Pinecone client for hosted reranker
_ranker = None   # local CrossEncoder fallback


def load_reranker() -> None:
    if settings.USE_PINECONE_RERANKER:
        _load_pinecone()
    else:
        _load_local()


def _load_pinecone() -> None:
    global _pc
    try:
        from pinecone import Pinecone
        _pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        logger.info("Pinecone inference reranker ready (model=%s)", settings.PINECONE_RERANKER_MODEL)
    except Exception as e:
        logger.warning("Could not init Pinecone reranker (%s) — trying local fallback.", e)
        _load_local()


def _load_local() -> None:
    global _ranker
    try:
        from sentence_transformers import CrossEncoder
        logger.info("Loading local reranker (%s)…", settings.RERANKER_MODEL)
        _ranker = CrossEncoder(settings.RERANKER_MODEL, max_length=512)
        logger.info("Local reranker loaded.")
    except Exception as e:
        logger.warning("Could not load reranker (%s) — results will use search order.", e)


async def rerank(query: str, texts: list[str]) -> list[float] | None:
    if len(texts) < _MIN_CANDIDATES:
        return None
    if _pc is not None:
        return await _pinecone_rerank(query, texts)
    if _ranker is not None:
        return await _local_rerank(query, texts)
    return None


def _pinecone_rerank_sync(query: str, texts: list[str]) -> list[float]:
    result = _pc.inference.rerank(
        model=settings.PINECONE_RERANKER_MODEL,
        query=query,
        documents=texts,
        top_n=len(texts),
        return_documents=False,
        parameters={"truncate": "END"},
    )
    scores_by_index = {r.index: r.score for r in result.data}
    return [scores_by_index.get(i, 0.0) for i in range(len(texts))]


async def _pinecone_rerank(query: str, texts: list[str]) -> list[float] | None:
    try:
        return await asyncio.to_thread(_pinecone_rerank_sync, query, texts)
    except Exception as e:
        logger.warning("Pinecone rerank failed (%s) — falling back to search order.", e)
        return None


def _local_rerank_sync(pairs: list[list[str]]) -> list[float]:
    import numpy as np
    logits = _ranker.predict(pairs)
    return (1.0 / (1.0 + np.exp(-logits))).tolist()


async def _local_rerank(query: str, texts: list[str]) -> list[float] | None:
    pairs = [[query, t[:2048]] for t in texts]
    try:
        return await asyncio.to_thread(_local_rerank_sync, pairs)
    except Exception as e:
        logger.warning("Local reranking failed (%s) — falling back to search order.", e)
        return None
