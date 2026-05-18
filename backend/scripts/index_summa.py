#!/usr/bin/env python3
"""
Embed each article section into Pinecone as a separate vector.

One vector per section: respondeo, sed_contra, each objection, each reply.
This gives the AI and search precise, citable chunks rather than whole articles.

Usage:
    cd backend
    python -m scripts.index_summa
"""

import asyncio
import json
import sys
import time
from pathlib import Path

import asyncpg
from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec
from pinecone_text.sparse import BM25Encoder

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.core.config import settings

BM25_PARAMS_PATH = Path(__file__).parent.parent / "data" / "bm25_params.json"
EMBED_BATCH = 20
UPSERT_BATCH = 100


# ── URL slug mapping ───────────────────────────────────────────────────────────

PART_TO_SLUG = {
    "prima-pars":       "1",
    "prima-secundae":   "1-2",
    "secunda-secundae": "2-2",
    "tertia-pars":      "3",
}


def article_url(part_id: str, question_n: int, article_n: int) -> str:
    slug = PART_TO_SLUG.get(part_id, part_id)
    return f"/{slug}/{question_n}/{article_n}"


# ── Section expansion ──────────────────────────────────────────────────────────

def expand_sections(row: asyncpg.Record) -> list[dict]:
    """
    Return one dict per indexable section.
    Each dict has: id, text, section, section_label, url_fragment, metadata.
    """
    pid = row["part_id"]
    qn  = row["question_n"]
    an  = row["article_n"]
    base_id = f"{pid}-q{qn:04d}-a{an:02d}"
    base_url = article_url(pid, qn, an)
    common = {
        "part_id":       pid,
        "part_abbr":     row["part_abbr"],
        "question_n":    qn,
        "question_title": row["question_title"],
        "article_n":     an,
        "article_title": row["article_title"],
        "source_url":    row["source_url"] or "",
    }

    chunks = []

    def add(vec_id, text, section, label, fragment):
        if not text or not text.strip():
            return
        chunks.append({
            "id":            vec_id,
            "text":          text.strip()[:4000],  # Pinecone metadata limit
            "section":       section,
            "section_label": label,
            "url_fragment":  fragment,
            "metadata":      {**common, "text": text.strip()[:4000],
                              "section": section, "section_label": label,
                              "url_fragment": fragment,
                              "article_url": base_url},
        })

    # Respondeo — most important
    add(f"{base_id}-respondeo", row["respondeo"],
        "respondeo", "I answer that", "respondeo")

    # Sed contra
    add(f"{base_id}-sed-contra", row["sed_contra"],
        "sed_contra", "On the contrary", "sed-contra")

    # Individual objections
    raw_obj = row["objections"]
    objections = json.loads(raw_obj) if isinstance(raw_obj, str) else (raw_obj or [])
    for obj in objections:
        n = obj["n"]
        add(f"{base_id}-obj-{n}", obj["text"],
            f"objection_{n}", f"Objection {n}", f"objection-{n}")

    # Individual replies
    raw_rep = row["replies"]
    replies = json.loads(raw_rep) if isinstance(raw_rep, str) else (raw_rep or [])
    for rep in replies:
        n = rep["n"]
        add(f"{base_id}-reply-{n}", rep["text"],
            f"reply_{n}", f"Reply to Objection {n}", f"reply-{n}")

    # Fallback: full body if no sections parsed
    if not chunks:
        add(f"{base_id}-body", row["body"], "body", "Full article", "body")

    return chunks


# ── Pinecone setup ─────────────────────────────────────────────────────────────

def create_index_if_missing(pc: Pinecone):
    existing = [i.name for i in pc.list_indexes()]
    if settings.PINECONE_INDEX_NAME in existing:
        print(f"Index '{settings.PINECONE_INDEX_NAME}' exists.")
        return
    print(f"Creating index '{settings.PINECONE_INDEX_NAME}'…")
    pc.create_index(
        name=settings.PINECONE_INDEX_NAME,
        dimension=settings.EMBED_DIM,
        metric="dotproduct",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
    while not pc.describe_index(settings.PINECONE_INDEX_NAME).status["ready"]:
        print("  Waiting…"); time.sleep(3)
    print("  Ready.")


# ── Embedding & BM25 ──────────────────────────────────────────────────────────

def fit_bm25(texts: list[str]) -> BM25Encoder:
    print(f"Fitting BM25 on {len(texts)} texts…")
    bm25 = BM25Encoder()
    bm25.fit(texts)
    BM25_PARAMS_PATH.parent.mkdir(parents=True, exist_ok=True)
    bm25.dump(str(BM25_PARAMS_PATH))
    print(f"Saved → {BM25_PARAMS_PATH}")
    return bm25


def embed_texts(client: OpenAI, texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model=settings.EMBED_MODEL, input=texts)
    return [r.embedding for r in sorted(resp.data, key=lambda x: x.index)]


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    for var, val in [("DATABASE_URL", settings.DATABASE_URL),
                     ("PINECONE_API_KEY", settings.PINECONE_API_KEY),
                     ("OPENAI_API_KEY", settings.OPENAI_API_KEY)]:
        if not val:
            print(f"ERROR: {var} not set"); sys.exit(1)

    pool  = await asyncpg.create_pool(settings.DATABASE_URL)
    pc    = Pinecone(api_key=settings.PINECONE_API_KEY)
    oai   = OpenAI(api_key=settings.OPENAI_API_KEY)

    create_index_if_missing(pc)
    index = pc.Index(settings.PINECONE_INDEX_NAME)

    # Load all articles
    async with pool.acquire() as conn:
        all_rows = await conn.fetch(
            """SELECT id, part_id, part_abbr, question_n, question_title,
                      article_n, article_title, body,
                      sed_contra, respondeo, objections, replies, source_url
               FROM summa_articles
               WHERE pinecone_indexed = FALSE
               ORDER BY part_id, question_n, article_n"""
        )

    print(f"{len(all_rows)} articles to index.")

    # Expand into sections
    all_chunks: list[dict] = []
    for row in all_rows:
        all_chunks.extend(expand_sections(row))

    print(f"{len(all_chunks)} section vectors total.")

    # Fit BM25 on all section texts
    bm25 = fit_bm25([c["text"] for c in all_chunks])

    # Upsert in batches
    total_upserted = 0
    article_ids_done: list[int] = []
    seen_article_ids: set[int] = set()

    for i in range(0, len(all_chunks), UPSERT_BATCH):
        batch = all_chunks[i: i + UPSERT_BATCH]
        texts = [c["text"] for c in batch]

        # Dense embeddings
        dense_vecs = []
        for j in range(0, len(texts), EMBED_BATCH):
            sub = texts[j: j + EMBED_BATCH]
            dense_vecs.extend(embed_texts(oai, sub))
            if j + EMBED_BATCH < len(texts):
                time.sleep(0.3)

        # Sparse BM25
        sparse_vecs = bm25.encode_documents(texts)

        vectors = [
            {
                "id": c["id"],
                "values": d,
                "sparse_values": {"indices": s["indices"], "values": s["values"]},
                "metadata": c["metadata"],
            }
            for c, d, s in zip(batch, dense_vecs, sparse_vecs)
        ]

        index.upsert(vectors=vectors, namespace=settings.PINECONE_NAMESPACE)
        total_upserted += len(vectors)
        print(f"  {total_upserted}/{len(all_chunks)} vectors upserted…", flush=True)

    # Mark articles indexed
    article_ids = [r["id"] for r in all_rows]
    if article_ids:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE summa_articles SET pinecone_indexed = TRUE WHERE id = ANY($1)",
                article_ids,
            )

    await pool.close()
    print(f"\nDone. {total_upserted} section vectors in Pinecone.")


if __name__ == "__main__":
    asyncio.run(main())
