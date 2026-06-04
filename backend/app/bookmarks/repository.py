import asyncpg

from app.bookmarks.domain import Bookmark

_SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bookmarks (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     TEXT        NOT NULL,
    part_id     TEXT        NOT NULL,
    question_n  INTEGER     NOT NULL,
    article_n   INTEGER,
    label       TEXT,
    folder      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user
    ON bookmarks(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique
    ON bookmarks(user_id, part_id, question_n, COALESCE(article_n, -1));

-- Idempotent migration for tables that predate the folder column
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS folder TEXT;
"""

_UNSET = object()


def _to_domain(row: asyncpg.Record) -> Bookmark:
    return Bookmark(
        id=row["id"],
        user_id=row["user_id"],
        part_id=row["part_id"],
        question_n=row["question_n"],
        article_n=row["article_n"],
        label=row["label"],
        folder=row["folder"],
        created_at=row["created_at"],
    )


class BookmarkRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def ensure_schema(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)

    async def list(self, user_id: str) -> list[Bookmark]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id, part_id, question_n, article_n, label, folder, created_at
                FROM bookmarks
                WHERE user_id = $1
                ORDER BY folder NULLS LAST, created_at DESC
                """,
                user_id,
            )
        return [_to_domain(r) for r in rows]

    async def add(
        self,
        *,
        user_id: str,
        part_id: str,
        question_n: int,
        article_n: int | None,
        label: str | None,
        folder: str | None,
    ) -> Bookmark:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO bookmarks (user_id, part_id, question_n, article_n, label, folder)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id, part_id, question_n, COALESCE(article_n, -1)) DO UPDATE
                    SET label  = EXCLUDED.label,
                        folder = EXCLUDED.folder
                RETURNING id, user_id, part_id, question_n, article_n, label, folder, created_at
                """,
                user_id, part_id, question_n, article_n, label, folder,
            )
        return _to_domain(row)

    async def update_folder(
        self, user_id: str, bookmark_id: str, folder: str | None
    ) -> Bookmark | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE bookmarks
                SET folder = $3
                WHERE id = $1 AND user_id = $2
                RETURNING id, user_id, part_id, question_n, article_n, label, folder, created_at
                """,
                bookmark_id, user_id, folder,
            )
        return _to_domain(row) if row else None

    async def delete(self, user_id: str, bookmark_id: str) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM bookmarks WHERE id = $1 AND user_id = $2",
                bookmark_id, user_id,
            )
        return result == "DELETE 1"
