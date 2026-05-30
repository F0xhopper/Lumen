#!/usr/bin/env python3

import asyncio
import json
import re
import sys
import time
from pathlib import Path

import asyncpg
import httpx
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.core.config import settings

BASE_URL = "https://www.corpusthomisticum.org/"
DELAY_S = 2.0

PART_PAGES: dict[str, list[str]] = {
    "prima-pars": [
        "sth1001.html", "sth1002.html", "sth1003.html", "sth1015.html",
        "sth1028.html", "sth1044.html", "sth1050.html", "sth1065.html",
        "sth1075.html", "sth1077.html", "sth1084.html", "sth1090.html",
        "sth1103.html",
    ],
    "prima-secundae": [
        "sth2001.html", "sth2006.html", "sth2022.html", "sth2026.html",
        "sth2040.html", "sth2049.html", "sth2055.html", "sth2071.html",
        "sth2072.html", "sth2073.html", "sth2074.html", "sth2075.html",
        "sth2085.html", "sth2090.html", "sth2093.html", "sth2094.html",
        "sth2095.html", "sth2098.html", "sth2106.html", "sth2109.html",
    ],
    "secunda-secundae": [
        "sth3001.html", "sth3017.html", "sth3023.html", "sth3025.html",
        "sth3027.html", "sth3034.html", "sth3044.html", "sth3045.html",
        "sth3047.html", "sth3057.html", "sth3061.html", "sth3079.html",
        "sth3080.html", "sth3081.html", "sth3082.html", "sth3092.html",
        "sth3101.html", "sth3102.html", "sth3106.html", "sth3109.html",
        "sth3121.html", "sth3122.html", "sth3123.html", "sth3141.html",
        "sth3143.html", "sth3144.html", "sth3146.html", "sth3155.html",
        "sth3170.html", "sth3171.html", "sth3179.html", "sth3183.html",
    ],
    "tertia-pars": [
        "sth4001.html", "sth4002.html", "sth4016.html", "sth4027.html",
        "sth4040.html", "sth4046.html", "sth4053.html", "sth4060.html",
        "sth4066.html", "sth4072.html", "sth4073.html", "sth4074.html",
        "sth4078.html", "sth4079.html", "sth4080.html", "sth4082.html",
        "sth4083.html", "sth4084.html",
    ],
}

TITLE_RE = re.compile(
    r"q\.\s*(\d+)\s+a\.\s*(\d+)\s+(arg\.\s*\d+|s\.\s*c\.|co\.|ad\s*\d+|pr\.)",
    re.IGNORECASE,
)
ARG_N_RE = re.compile(r"arg\.\s*(\d+)", re.IGNORECASE)
AD_N_RE  = re.compile(r"ad\s*(\d+)",  re.IGNORECASE)


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_text(p) -> str:
    parts = []
    for el in p.children:
        name = getattr(el, "name", None)
        if name == "a":
            continue
        elif name == "i":
            inner = el.get_text().strip()
            if inner:
                parts.append(f'"{inner}"')
        elif name is not None:
            parts.append(el.get_text())
        else:
            parts.append(str(el))
    return clean("".join(parts))


def parse_page(html: str, part_id: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    articles: dict[tuple[int, int], dict] = {}

    for p in soup.find_all("p", title=True):
        title_attr = p.get("title", "")
        m = TITLE_RE.search(title_attr)
        if not m:
            continue

        q_n      = int(m.group(1))
        a_n      = int(m.group(2))
        sec_code = m.group(3).strip().lower()
        key      = (q_n, a_n)

        if key not in articles:
            articles[key] = {
                "part_id":       part_id,
                "question_n":    q_n,
                "article_n":     a_n,
                "body_la":       None,
                "sed_contra_la": None,
                "respondeo_la":  None,
                "objections_la": [],
                "replies_la":    [],
                "source_url_la": source_url,
            }

        text = extract_text(p)
        if not text:
            continue

        art = articles[key]
        if "arg." in sec_code:
            mn = ARG_N_RE.search(sec_code)
            n  = int(mn.group(1)) if mn else len(art["objections_la"]) + 1
            art["objections_la"].append({"n": n, "text": text})
        elif re.search(r"s\.\s*c\.", sec_code):
            art["sed_contra_la"] = text
        elif sec_code == "co.":
            art["respondeo_la"] = text
        elif sec_code.startswith("ad"):
            mn = AD_N_RE.search(sec_code)
            n  = int(mn.group(1)) if mn else len(art["replies_la"]) + 1
            art["replies_la"].append({"n": n, "text": text})
        elif sec_code == "pr.":
            art["body_la"] = text

    return list(articles.values())


async def upsert_latin_batch(conn: asyncpg.Connection, articles: list[dict]) -> int:
    result = await conn.executemany(
        """
        UPDATE summa_articles SET
            body_la        = $4,
            sed_contra_la  = $5,
            respondeo_la   = $6,
            objections_la  = $7,
            replies_la     = $8,
            source_url_la  = $9
        WHERE part_id = $1 AND question_n = $2 AND article_n = $3
        """,
        [
            (
                a["part_id"], a["question_n"], a["article_n"],
                a["body_la"], a["sed_contra_la"], a["respondeo_la"],
                json.dumps(a["objections_la"]), json.dumps(a["replies_la"]),
                a["source_url_la"],
            )
            for a in articles
        ],
    )
    return len(articles)


async def main() -> None:
    if not settings.DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    ssl = "require" if settings.DATABASE_SSL else None
    pool = await asyncpg.create_pool(settings.DATABASE_URL, ssl=ssl)

    total, errors = 0, []

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for part_id, pages in PART_PAGES.items():
            print(f"\n=== {part_id} ({len(pages)} pages) ===")
            for page_file in pages:
                url = BASE_URL + page_file
                try:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    html = resp.content.decode("iso-8859-1")
                    articles = parse_page(html, part_id, url)

                    if articles:
                        async with pool.acquire() as conn:
                            await upsert_latin_batch(conn, articles)
                        total += len(articles)
                        has_resp = sum(1 for a in articles if a["respondeo_la"])
                        has_obj = sum(1 for a in articles if a["objections_la"])
                        print(
                            f"  {page_file}: {len(articles)} articles, "
                            f"{has_resp} respondeo, {has_obj} with objections",
                            flush=True,
                        )
                    else:
                        print(f"  {page_file}: no articles parsed", flush=True)

                except Exception as e:
                    print(f"  {page_file}: ERROR — {e}", flush=True)
                    errors.append((part_id, page_file, str(e)))

                time.sleep(DELAY_S)

    await pool.close()
    print(f"\nDone. {total} articles updated.")
    if errors:
        print(f"{len(errors)} errors:")
        for err in errors:
            print(f"  {err}")


if __name__ == "__main__":
    asyncio.run(main())
