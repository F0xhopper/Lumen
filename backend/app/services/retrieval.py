"""Hybrid search against Pinecone (dense + sparse BM25)."""

from pathlib import Path

from openai import AsyncOpenAI
from pinecone_text.sparse import BM25Encoder

from app.core.config import settings
from app.core.dependencies import get_openai, get_pinecone_index
from app.core.logging import get_logger

logger = get_logger(__name__)

BM25_PARAMS_PATH = Path(__file__).parent.parent.parent / "data" / "bm25_params.json"

_bm25: BM25Encoder | None = None


def _load_bm25() -> BM25Encoder | None:
    global _bm25
    if _bm25 is not None:
        return _bm25
    if not BM25_PARAMS_PATH.exists():
        logger.warning("BM25 params not found — sparse search disabled. Run scripts/index_summa.py first.")
        return None
    _bm25 = BM25Encoder()
    _bm25.load(str(BM25_PARAMS_PATH))
    return _bm25


async def embed(text: str) -> list[float]:
    client: AsyncOpenAI = get_openai()
    resp = await client.embeddings.create(model=settings.EMBED_MODEL, input=text)
    return resp.data[0].embedding


async def hybrid_search(query: str, top_k: int = 8, alpha: float = 0.7) -> list[dict]:
    """
    alpha=1.0 → pure semantic, alpha=0.0 → pure keyword, default 0.7.
    Returns passage dicts including section and url_fragment fields.
    """
    dense = await embed(query)
    index = get_pinecone_index()
    bm25  = _load_bm25()

    query_kwargs: dict = {
        "namespace":        settings.PINECONE_NAMESPACE,
        "top_k":            top_k,
        "include_metadata": True,
    }

    if bm25 is not None:
        sparse = bm25.encode_queries(query)
        query_kwargs["vector"]        = [v * alpha for v in dense]
        query_kwargs["sparse_vector"] = {
            "indices": sparse["indices"],
            "values":  [v * (1 - alpha) for v in sparse["values"]],
        }
    else:
        query_kwargs["vector"] = dense

    result = index.query(**query_kwargs)

    passages = []
    for i, match in enumerate(result.matches, 1):
        meta = match.metadata or {}
        passages.append({
            "rank":          i,
            "text":          meta.get("text", ""),
            "score":         round(match.score, 4),
            "part_abbr":     meta.get("part_abbr", ""),
            "question_n":    int(meta.get("question_n", 0)),
            "article_n":     int(meta.get("article_n", 0)),
            "question_title": meta.get("question_title", ""),
            "article_title": meta.get("article_title", ""),
            "section":       meta.get("section", "body"),
            "section_label": meta.get("section_label", ""),
            "url_fragment":  meta.get("url_fragment", ""),
            "article_url":   meta.get("article_url", ""),
            "source_url":    meta.get("source_url", ""),
        })
    return passages
