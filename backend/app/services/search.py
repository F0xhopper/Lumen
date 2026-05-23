"""Pinecone hybrid search (dense + sparse via BM25)."""

from pathlib import Path

from pinecone_text.sparse import BM25Encoder

from app.core.logging import get_logger
from app.repositories.pinecone_repo import PineconeMatch, PineconeRepository

logger = get_logger(__name__)

BM25_PARAMS_PATH = Path(__file__).parent.parent.parent / "data" / "bm25_params.json"

_bm25: BM25Encoder | None = None


def load_bm25() -> BM25Encoder | None:
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


async def pinecone_hybrid_search(
    query_text: str,
    dense_vector: list[float],
    repo: PineconeRepository,
    top_k: int,
) -> list[PineconeMatch]:
    bm25 = _bm25
    sparse = bm25.encode_queries(query_text) if bm25 is not None else None
    return await repo.hybrid_query(dense_vector, sparse, top_k)
