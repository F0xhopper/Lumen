"""PostgreSQL queries for summa_articles."""

import json
import asyncpg

from app.core.dependencies import get_db_pool

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS summa_articles (
    id SERIAL PRIMARY KEY,
    part_id TEXT NOT NULL,
    part_abbr TEXT NOT NULL,
    question_n INTEGER NOT NULL,
    question_title TEXT NOT NULL,
    article_n INTEGER NOT NULL,
    article_title TEXT NOT NULL,
    body TEXT NOT NULL,
    sed_contra TEXT,
    respondeo TEXT,
    objections JSONB DEFAULT '[]'::jsonb,
    replies JSONB DEFAULT '[]'::jsonb,
    source_url TEXT,
    pinecone_indexed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (part_id, question_n, article_n)
);
"""

MIGRATE_SQL = """
ALTER TABLE summa_articles
    ADD COLUMN IF NOT EXISTS sed_contra TEXT,
    ADD COLUMN IF NOT EXISTS respondeo TEXT,
    ADD COLUMN IF NOT EXISTS objections JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS replies JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS body_la TEXT,
    ADD COLUMN IF NOT EXISTS sed_contra_la TEXT,
    ADD COLUMN IF NOT EXISTS respondeo_la TEXT,
    ADD COLUMN IF NOT EXISTS objections_la JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS replies_la JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source_url_la TEXT;
"""

_TRGM_INDEX_SQLS = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    "CREATE INDEX IF NOT EXISTS idx_summa_respondeo_trgm  ON summa_articles USING gin (respondeo  gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS idx_summa_sed_contra_trgm ON summa_articles USING gin (sed_contra gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS idx_summa_body_trgm        ON summa_articles USING gin (body       gin_trgm_ops)",
]


async def ensure_schema():
    pool = get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(CREATE_TABLE_SQL)
        await conn.execute(MIGRATE_SQL)
        try:
            for sql in _TRGM_INDEX_SQLS:
                await conn.execute(sql)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                "Could not create pg_trgm indexes (%s) — ILIKE search will be slower.", e
            )


async def get_articles_for_question(part_id: str, question_n: int) -> list[asyncpg.Record]:
    pool = get_db_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT article_n, article_title
            FROM summa_articles
            WHERE part_id = $1 AND question_n = $2
            ORDER BY article_n
            """,
            part_id, question_n,
        )


async def get_article(part_id: str, question_n: int, article_n: int) -> asyncpg.Record | None:
    pool = get_db_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT part_id, part_abbr, question_n, question_title,
                   article_n, article_title, body,
                   sed_contra, respondeo, objections, replies,
                   source_url,
                   body_la, sed_contra_la, respondeo_la,
                   objections_la, replies_la, source_url_la
            FROM summa_articles
            WHERE part_id = $1 AND question_n = $2 AND article_n = $3
            """,
            part_id, question_n, article_n,
        )


async def get_all_for_indexing() -> list[asyncpg.Record]:
    pool = get_db_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT id, part_id, part_abbr, question_n, question_title,
                   article_n, article_title, body,
                   sed_contra, respondeo, objections, replies,
                   source_url
            FROM summa_articles
            WHERE pinecone_indexed = FALSE
            ORDER BY part_id, question_n, article_n
            """,
        )


async def mark_indexed(article_ids: list[int]):
    pool = get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE summa_articles SET pinecone_indexed = TRUE WHERE id = ANY($1)",
            article_ids,
        )


async def ilike_search(query: str, limit: int = 8) -> list[asyncpg.Record]:
    """Return one row per matching section (same granularity as Pinecone vectors)."""
    pool = get_db_pool()
    # Escape the ILIKE metacharacters so user input is treated as a literal string.
    # '!' is our escape character; it must be escaped first to avoid double-escaping.
    safe = query.replace("!", "!!").replace("%", "!%").replace("_", "!_")
    pattern = f"%{safe}%"
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT part_id, part_abbr, question_n, question_title,
                   article_n, article_title, source_url,
                   sed_contra          AS text,
                   'sed_contra'        AS section,
                   'On the contrary'   AS section_label,
                   'sed-contra'        AS url_fragment
            FROM summa_articles
            WHERE sed_contra ILIKE $1 ESCAPE '!'

            UNION ALL

            SELECT part_id, part_abbr, question_n, question_title,
                   article_n, article_title, source_url,
                   respondeo       AS text,
                   'respondeo'     AS section,
                   'I answer that' AS section_label,
                   'respondeo'     AS url_fragment
            FROM summa_articles
            WHERE respondeo ILIKE $1 ESCAPE '!'

            UNION ALL

            SELECT a.part_id, a.part_abbr, a.question_n, a.question_title,
                   a.article_n, a.article_title, a.source_url,
                   obj->>'text'                        AS text,
                   'objection_' || (obj->>'n')         AS section,
                   'Objection ' || (obj->>'n')         AS section_label,
                   'objection-' || (obj->>'n')         AS url_fragment
            FROM summa_articles a, jsonb_array_elements(a.objections) AS obj
            WHERE obj->>'text' ILIKE $1 ESCAPE '!'

            UNION ALL

            SELECT a.part_id, a.part_abbr, a.question_n, a.question_title,
                   a.article_n, a.article_title, a.source_url,
                   rep->>'text'                              AS text,
                   'reply_' || (rep->>'n')                  AS section,
                   'Reply to Objection ' || (rep->>'n')     AS section_label,
                   'reply-' || (rep->>'n')                  AS url_fragment
            FROM summa_articles a, jsonb_array_elements(a.replies) AS rep
            WHERE rep->>'text' ILIKE $1 ESCAPE '!'

            ORDER BY question_n, article_n
            LIMIT $2
            """,
            pattern, limit,
        )


async def upsert_article(
    part_id: str,
    part_abbr: str,
    question_n: int,
    question_title: str,
    article_n: int,
    article_title: str,
    body: str,
    sed_contra: str | None,
    respondeo: str | None,
    objections: list[dict],
    replies: list[dict],
    source_url: str | None,
    body_la: str | None = None,
    sed_contra_la: str | None = None,
    respondeo_la: str | None = None,
    objections_la: list[dict] | None = None,
    replies_la: list[dict] | None = None,
    source_url_la: str | None = None,
):
    pool = get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO summa_articles
                (part_id, part_abbr, question_n, question_title,
                 article_n, article_title, body,
                 sed_contra, respondeo, objections, replies, source_url,
                 body_la, sed_contra_la, respondeo_la,
                 objections_la, replies_la, source_url_la)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18)
            ON CONFLICT (part_id, question_n, article_n)
            DO UPDATE SET
                question_title = EXCLUDED.question_title,
                article_title  = EXCLUDED.article_title,
                body           = EXCLUDED.body,
                sed_contra     = EXCLUDED.sed_contra,
                respondeo      = EXCLUDED.respondeo,
                objections     = EXCLUDED.objections,
                replies        = EXCLUDED.replies,
                source_url     = EXCLUDED.source_url,
                pinecone_indexed = FALSE
            """,
            part_id, part_abbr, question_n, question_title,
            article_n, article_title, body,
            sed_contra, respondeo,
            json.dumps(objections), json.dumps(replies), source_url,
            body_la, sed_contra_la, respondeo_la,
            json.dumps(objections_la or []), json.dumps(replies_la or []), source_url_la,
        )


async def upsert_latin(
    part_id: str,
    question_n: int,
    article_n: int,
    body_la: str | None,
    sed_contra_la: str | None,
    respondeo_la: str | None,
    objections_la: list[dict],
    replies_la: list[dict],
    source_url_la: str | None,
):
    """Update only the Latin fields for an existing article."""
    pool = get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE summa_articles
            SET body_la        = $4,
                sed_contra_la  = $5,
                respondeo_la   = $6,
                objections_la  = $7,
                replies_la     = $8,
                source_url_la  = $9
            WHERE part_id = $1 AND question_n = $2 AND article_n = $3
            """,
            part_id, question_n, article_n,
            body_la, sed_contra_la, respondeo_la,
            json.dumps(objections_la), json.dumps(replies_la), source_url_la,
        )
