import asyncpg

from app.preferences.domain import FontPrefs, DEFAULT_FONT_PREFS

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         TEXT        PRIMARY KEY,
    font_family     TEXT        NOT NULL DEFAULT 'cardo',
    font_size       TEXT        NOT NULL DEFAULT 'md',
    line_height     TEXT        NOT NULL DEFAULT 'normal',
    letter_spacing  TEXT        NOT NULL DEFAULT 'normal',
    font_weight     TEXT        NOT NULL DEFAULT 'regular',
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
"""

_VALID_FONT_FAMILIES = {"cardo", "lora", "garamond", "baskerville", "georgia", "inter"}
_VALID_FONT_SIZES = {"sm", "md", "lg", "xl"}
_VALID_LINE_HEIGHTS = {"compact", "normal", "relaxed"}
_VALID_LETTER_SPACINGS = {"tight", "normal", "loose"}
_VALID_FONT_WEIGHTS = {"regular", "medium"}


def _to_domain(row: asyncpg.Record) -> FontPrefs:
    d = DEFAULT_FONT_PREFS
    return FontPrefs(
        font_family=row["font_family"] if row["font_family"] in _VALID_FONT_FAMILIES else d.font_family,
        font_size=row["font_size"] if row["font_size"] in _VALID_FONT_SIZES else d.font_size,
        line_height=row["line_height"] if row["line_height"] in _VALID_LINE_HEIGHTS else d.line_height,
        letter_spacing=row["letter_spacing"] if row["letter_spacing"] in _VALID_LETTER_SPACINGS else d.letter_spacing,
        font_weight=row["font_weight"] if row["font_weight"] in _VALID_FONT_WEIGHTS else d.font_weight,
    )


class PreferencesRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def ensure_schema(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)

    async def get(self, user_id: str) -> FontPrefs:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM user_preferences WHERE user_id = $1",
                user_id,
            )
        return _to_domain(row) if row else DEFAULT_FONT_PREFS

    async def upsert(self, user_id: str, prefs: FontPrefs) -> FontPrefs:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO user_preferences
                    (user_id, font_family, font_size, line_height, letter_spacing, font_weight, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    font_family    = EXCLUDED.font_family,
                    font_size      = EXCLUDED.font_size,
                    line_height    = EXCLUDED.line_height,
                    letter_spacing = EXCLUDED.letter_spacing,
                    font_weight    = EXCLUDED.font_weight,
                    updated_at     = NOW()
                RETURNING *
                """,
                user_id,
                prefs.font_family,
                prefs.font_size,
                prefs.line_height,
                prefs.letter_spacing,
                prefs.font_weight,
            )
        return _to_domain(row)
