import asyncpg

from app.history.domain import HistoryEntry

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS history (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     TEXT        NOT NULL,
    part_id     TEXT        NOT NULL,
    question_n  INTEGER     NOT NULL,
    article_n   INTEGER,
    visited_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_user
    ON history(user_id, visited_at DESC);
"""

_MAX_ENTRIES = 50


def _to_domain(row: asyncpg.Record) -> HistoryEntry:
    return HistoryEntry(
        id=row["id"],
        user_id=row["user_id"],
        part_id=row["part_id"],
        question_n=row["question_n"],
        article_n=row["article_n"],
        visited_at=row["visited_at"],
    )


class HistoryRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def ensure_schema(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)

    async def list(self, user_id: str) -> list[HistoryEntry]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id, part_id, question_n, article_n, visited_at
                FROM history
                WHERE user_id = $1
                ORDER BY visited_at DESC
                LIMIT $2
                """,
                user_id, _MAX_ENTRIES,
            )
        return [_to_domain(r) for r in rows]

    async def record(
        self,
        *,
        user_id: str,
        part_id: str,
        question_n: int,
        article_n: int | None,
    ) -> HistoryEntry:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO history (user_id, part_id, question_n, article_n, visited_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id, user_id, part_id, question_n, article_n, visited_at
                """,
                user_id, part_id, question_n, article_n,
            )
            # Prune to keep only the most recent _MAX_ENTRIES rows per user
            await conn.execute(
                """
                DELETE FROM history
                WHERE user_id = $1
                  AND id NOT IN (
                      SELECT id FROM history
                      WHERE user_id = $1
                      ORDER BY visited_at DESC
                      LIMIT $2
                  )
                """,
                user_id, _MAX_ENTRIES,
            )
        return _to_domain(row)

    async def clear(self, user_id: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute("DELETE FROM history WHERE user_id = $1", user_id)
