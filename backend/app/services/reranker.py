"""Cross-encoder reranking via sentence-transformers."""

import asyncio

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_ranker = None


def load_reranker():
    global _ranker
    if _ranker is not None:
        return _ranker
    try:
        from sentence_transformers import CrossEncoder

        logger.info("Loading reranker (%s)…", settings.RERANKER_MODEL)
        _ranker = CrossEncoder(settings.RERANKER_MODEL, max_length=512)
        logger.info("Reranker loaded.")
    except Exception as e:
        logger.warning("Could not load reranker (%s) — results will use search order.", e)
    return _ranker


def _score_pairs_sync(ranker, pairs: list[list[str]]) -> list[float]:
    import numpy as np

    logits = ranker.predict(pairs)
    return (1.0 / (1.0 + np.exp(-logits))).tolist()


async def rerank(query: str, texts: list[str]) -> list[float] | None:
    """Return sigmoid-normalised scores in texts order, or None if reranker unavailable."""
    ranker = _ranker
    if ranker is None:
        return None
    pairs = [[query, t[:2048]] for t in texts]
    try:
        return await asyncio.to_thread(_score_pairs_sync, ranker, pairs)
    except Exception as e:
        logger.warning("Reranking failed (%s) — falling back to search order.", e)
        return None
