"""Wraps Pinecone Index API — services never touch the raw Pinecone client shape."""

import asyncio
from dataclasses import dataclass, field

from app.core.config import settings


@dataclass
class PineconeMatch:
    text: str
    score: float
    metadata: dict = field(default_factory=dict)


class PineconeRepository:
    def __init__(self, index):
        self._index = index

    async def hybrid_query(
        self,
        dense_vector: list[float],
        sparse_vector: dict | None,
        top_k: int,
    ) -> list[PineconeMatch]:
        kwargs = dict(
            namespace=settings.PINECONE_NAMESPACE,
            top_k=top_k,
            include_metadata=True,
        )
        if sparse_vector is not None:
            result = await asyncio.to_thread(
                self._index.query,
                vector=[v * 0.7 for v in dense_vector],
                sparse_vector={
                    "indices": sparse_vector["indices"],
                    "values": [v * 0.3 for v in sparse_vector["values"]],
                },
                **kwargs,
            )
        else:
            result = await asyncio.to_thread(
                self._index.query, vector=dense_vector, **kwargs
            )
        return [
            PineconeMatch(
                text=(m.metadata or {}).get("text", ""),
                score=float(m.score),
                metadata=m.metadata or {},
            )
            for m in result.matches
        ]
