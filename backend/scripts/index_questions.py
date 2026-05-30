"""One-time script: embed all question titles and upsert to Pinecone 'questions' namespace.

Usage (from backend/):
    python -m scripts.index_questions
"""
import asyncio
import sys
from pathlib import Path

import asyncpg
from openai import AsyncOpenAI
from pinecone import Pinecone

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.core.config import settings

NAMESPACE = "questions"
EMBED_BATCH = 20
UPSERT_BATCH = 100


async def main() -> None:
    db = await asyncpg.connect(settings.DATABASE_URL)
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    index = pc.Index(settings.PINECONE_INDEX_NAME)

    rows = await db.fetch(
        """
        SELECT DISTINCT part_id, part_abbr, question_n, question_title
        FROM summa_articles
        ORDER BY part_id, question_n
        """
    )
    await db.close()

    questions = [dict(r) for r in rows]
    titles = [q["question_title"] for q in questions]
    print(f"Embedding {len(titles)} question titles with {settings.EMBED_MODEL}…")

    embeddings: list[list[float]] = []
    for i in range(0, len(titles), EMBED_BATCH):
        batch = titles[i : i + EMBED_BATCH]
        resp = await client.embeddings.create(model=settings.EMBED_MODEL, input=batch)
        embeddings.extend(e.embedding for e in resp.data)
        print(f"  embedded {min(i + EMBED_BATCH, len(titles))}/{len(titles)}")

    vectors = [
        {
            "id": f"{q['part_id']}-q{q['question_n']:04d}",
            "values": emb,
            "metadata": {
                "part_id": q["part_id"],
                "part_abbr": q["part_abbr"],
                "question_n": q["question_n"],
                "question_title": q["question_title"],
            },
        }
        for q, emb in zip(questions, embeddings)
    ]

    print(f"Upserting {len(vectors)} vectors to namespace '{NAMESPACE}'…")
    for i in range(0, len(vectors), UPSERT_BATCH):
        batch = vectors[i : i + UPSERT_BATCH]
        index.upsert(vectors=batch, namespace=NAMESPACE)
        print(f"  upserted {min(i + UPSERT_BATCH, len(vectors))}/{len(vectors)}")

    print("Done.")


asyncio.run(main())
