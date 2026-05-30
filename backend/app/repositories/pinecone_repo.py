import asyncio

from pydantic import BaseModel, Field

from app.core.config import settings


class PineconeMatch(BaseModel):
    text: str
    score: float
    metadata: dict = Field(default_factory=dict)


class PineconeRepository:
    def __init__(self, index):
        self._index = index

    async def hybrid_query(
        self,
        dense_vector: list[float],
        sparse_vector: dict | None,
        top_k: int,
        alpha: float = 0.7,
        namespace: str | None = None,
    ) -> list[PineconeMatch]:
        kwargs = dict(
            namespace=namespace or settings.PINECONE_NAMESPACE,
            top_k=top_k,
            include_metadata=True,
        )
        if sparse_vector is not None:
            result = await asyncio.to_thread(
                self._index.query,
                vector=[v * alpha for v in dense_vector],
                sparse_vector={
                    "indices": sparse_vector["indices"],
                    "values": [v * (1 - alpha) for v in sparse_vector["values"]],
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
