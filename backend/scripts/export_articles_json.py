#!/usr/bin/env python3
"""
Export all Summa articles from PostgreSQL to static JSON files.

Output: frontend/public/data/articles/{part_id}-q{n}-a{n}.json

Run once after import_summa.py (and re-run if DB content ever changes):
    cd backend
    source .venv/bin/activate
    python -m scripts.export_articles_json
"""
import asyncio
import json
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.core.config import settings

OUTPUT_DIR = (
    Path(__file__).parent.parent.parent / "frontend" / "public" / "data" / "articles"
)


def _parse_jsonb(val) -> list:
    if val is None:
        return []
    if isinstance(val, str):
        return json.loads(val)
    return list(val)


async def main():
    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    ssl = "require" if settings.DATABASE_SSL else None
    pool = await asyncpg.create_pool(settings.DATABASE_URL, ssl=ssl)

    rows = await pool.fetch(
        """
        SELECT part_id, part_abbr, question_n, question_title,
               article_n, article_title, body,
               sed_contra, respondeo, objections, replies, source_url,
               body_la, sed_contra_la, respondeo_la,
               objections_la, replies_la, source_url_la
        FROM summa_articles
        ORDER BY part_id, question_n, article_n
        """
    )
    await pool.close()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for i, row in enumerate(rows):
        d = dict(row)
        for field in ("objections", "replies", "objections_la", "replies_la"):
            d[field] = _parse_jsonb(d[field])

        filename = f"{d['part_id']}-q{d['question_n']}-a{d['article_n']}.json"
        (OUTPUT_DIR / filename).write_text(
            json.dumps(d, ensure_ascii=False), encoding="utf-8"
        )

        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(rows)} exported…")

    print(f"Done. {len(rows)} articles → {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
