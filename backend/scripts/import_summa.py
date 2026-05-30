#!/usr/bin/env python3

import asyncio
import json
import re
import sys
import time
from pathlib import Path

import asyncpg
import httpx
from bs4 import BeautifulSoup, Tag

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.core.config import settings

PARTS = [
    {"id": "prima-pars",       "abbr": "ST I",    "prefix": "1", "questions": 119},
    {"id": "prima-secundae",   "abbr": "ST I-II", "prefix": "2", "questions": 114},
    {"id": "secunda-secundae", "abbr": "ST II-II","prefix": "3", "questions": 189},
    {"id": "tertia-pars",      "abbr": "ST III",  "prefix": "4", "questions": 90},
]

BASE_URL = "https://www.newadvent.org/summa/"
DELAY_S = 1.5


def build_url(prefix: str, question_n: int) -> str:
    return f"{BASE_URL}{prefix}{question_n:03d}.htm"


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


OBJ_RE   = re.compile(r"^Objection\s+(\d+)\.?", re.IGNORECASE)
REPLY_RE = re.compile(r"^Reply to Objection\s+(\d+)\.?", re.IGNORECASE)
SC_RE    = re.compile(r"^On the contrary[,.]?", re.IGNORECASE)
ANS_RE   = re.compile(r"^I answer that[,.]?", re.IGNORECASE)


def parse_sections(paragraphs: list[Tag]) -> dict:
    sections: dict = {
        "objections": [],
        "sed_contra": None,
        "respondeo": None,
        "replies": [],
    }

    current_type = None
    current_n = None
    current_parts: list[str] = []

    def flush():
        text = clean(" ".join(current_parts))
        if not text:
            return
        if current_type == "obj":
            sections["objections"].append({"n": current_n, "text": text})
        elif current_type == "sc":
            sections["sed_contra"] = text
        elif current_type == "ans":
            sections["respondeo"] = text
        elif current_type == "reply":
            sections["replies"].append({"n": current_n, "text": text})

    for p in paragraphs:
        text = clean(p.get_text())
        if not text:
            continue

        m_obj   = OBJ_RE.match(text)
        m_reply = REPLY_RE.match(text)

        if m_obj:
            flush()
            current_type, current_n, current_parts = "obj", int(m_obj.group(1)), ([text] if text else [])
        elif SC_RE.match(text):
            flush()
            current_type, current_n, current_parts = "sc", None, ([text] if text else [])
        elif ANS_RE.match(text):
            flush()
            current_type, current_n, current_parts = "ans", None, ([text] if text else [])
        elif m_reply:
            flush()
            current_type, current_n, current_parts = "reply", int(m_reply.group(1)), ([text] if text else [])
        else:
            if current_type is not None:
                current_parts.append(text)

    flush()
    return sections


def parse_question_page(html: str, part: dict, question_n: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find("h1")
    question_title = clean(h1.get_text()) if h1 else f"Question {question_n}"
    question_title = re.sub(r"^QUESTION\s+\d+\.\s*", "", question_title, flags=re.IGNORECASE)

    article_headings = soup.find_all("h2")
    articles = []

    for h2 in article_headings:
        raw_title = clean(h2.get_text())
        m = re.match(r"Article\s+(\d+)\.\s*(.*)", raw_title, re.IGNORECASE)
        if not m:
            continue
        article_n = int(m.group(1))
        article_title = m.group(2).strip()

        paragraphs: list[Tag] = []
        body_parts: list[str] = []
        for sib in h2.next_siblings:
            if getattr(sib, "name", None) == "h2":
                break
            if getattr(sib, "name", None) == "p":
                paragraphs.append(sib)
                t = clean(sib.get_text())
                if t:
                    body_parts.append(t)

        body = "\n\n".join(body_parts)
        sects = parse_sections(paragraphs)

        articles.append({
            "part_id":       part["id"],
            "part_abbr":     part["abbr"],
            "question_n":    question_n,
            "question_title": question_title,
            "article_n":     article_n,
            "article_title": article_title,
            "body":          body,
            "sed_contra":    sects["sed_contra"],
            "respondeo":     sects["respondeo"],
            "objections":    sects["objections"],
            "replies":       sects["replies"],
            "source_url":    build_url(part["prefix"], question_n),
        })

    return articles


SCHEMA_SQL = """
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
ALTER TABLE summa_articles
    ADD COLUMN IF NOT EXISTS sed_contra TEXT,
    ADD COLUMN IF NOT EXISTS respondeo TEXT,
    ADD COLUMN IF NOT EXISTS objections JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS replies JSONB DEFAULT '[]'::jsonb;
"""


async def upsert_articles(conn: asyncpg.Connection, articles: list[dict]):
    await conn.executemany(
        """
        INSERT INTO summa_articles
            (part_id, part_abbr, question_n, question_title,
             article_n, article_title, body,
             sed_contra, respondeo, objections, replies,
             source_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (part_id, question_n, article_n) DO UPDATE SET
            question_title   = EXCLUDED.question_title,
            article_title    = EXCLUDED.article_title,
            body             = EXCLUDED.body,
            sed_contra       = EXCLUDED.sed_contra,
            respondeo        = EXCLUDED.respondeo,
            objections       = EXCLUDED.objections,
            replies          = EXCLUDED.replies,
            source_url       = EXCLUDED.source_url,
            pinecone_indexed = FALSE
        """,
        [
            (
                a["part_id"], a["part_abbr"], a["question_n"], a["question_title"],
                a["article_n"], a["article_title"], a["body"],
                a["sed_contra"], a["respondeo"],
                json.dumps(a["objections"]), json.dumps(a["replies"]),
                a["source_url"],
            )
            for a in articles
        ],
    )


async def main():
    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    pool = await asyncpg.create_pool(settings.DATABASE_URL)
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)

    total, errors = 0, []

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for part in PARTS:
            print(f"\n=== {part['abbr']} ({part['questions']} questions) ===")
            for q_n in range(1, part["questions"] + 1):
                url = build_url(part["prefix"], q_n)
                try:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    articles = parse_question_page(resp.text, part, q_n)
                    if articles:
                        async with pool.acquire() as conn:
                            await upsert_articles(conn, articles)
                        total += len(articles)
                        has_resp = sum(1 for a in articles if a["respondeo"])
                        print(f"  Q.{q_n}: {len(articles)} articles, {has_resp} with respondeo", flush=True)
                    else:
                        print(f"  Q.{q_n}: no articles parsed", flush=True)
                except Exception as e:
                    print(f"  Q.{q_n}: ERROR — {e}", flush=True)
                    errors.append((part["id"], q_n, str(e)))
                time.sleep(DELAY_S)

    await pool.close()
    print(f"\nDone. {total} articles stored.")
    if errors:
        print(f"{len(errors)} errors: {errors}")


if __name__ == "__main__":
    asyncio.run(main())
