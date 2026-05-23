"""OpenAI text embedding."""

from openai import AsyncOpenAI

from app.core.config import settings


async def embed(text: str, client: AsyncOpenAI) -> list[float]:
    resp = await client.embeddings.create(model=settings.EMBED_MODEL, input=text)
    return resp.data[0].embedding
