"""Generate answers via GPT using retrieved Summa sections."""

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.dependencies import get_openai
from app.core.logging import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are a scholarly assistant specializing in the Summa Theologica of St. Thomas Aquinas.

CITATION FORMAT — this is critical:
- Each retrieved passage has a location like "ST I Q.2 A.3 — I answer that"
- Cite inline as: (ST I Q.2 A.3 — Respondeo) using the section label provided
- When citing, also include a markdown link to the exact section, e.g.:
  [(ST I Q.2 A.3 — Respondeo)](/1/2/3#respondeo)
- The article_url and url_fragment fields give you the exact link. Combine them: {article_url}#{url_fragment}
- Assign reference numbers [1], [2] etc. in order of first appearance
- End with a References section listing each citation with its link

PART URL SLUGS for building links:
  ST I    → /1/...
  ST I-II → /1-2/...
  ST II-II → /2-2/...
  ST III  → /3/...
  Format: /{part-slug}/{question_n}/{article_n}#{url_fragment}

PRIMARY SOURCE RULES:
- Ground every claim in the retrieved passages
- Use Aquinas's own words where possible; use blockquotes (> text) for direct quotes
- Note his structure: objections → sed contra → respondeo → replies
- Distinguish what Aquinas states vs. positions he argues against
- Acknowledge when a question goes beyond what he directly addressed

RESPONSE STYLE:
- Scholarly but readable
- Prioritize the Respondeo — that is always Aquinas's own position
- Use the Sed Contra to frame the tradition he is defending
- Objections and replies show the dialectical method"""


def _format_context(passages: list[dict]) -> str:
    lines = []
    for p in passages:
        loc = f"ST {p['part_abbr']} Q.{p['question_n']} A.{p['article_n']} — {p['section_label']}"
        link = f"{p.get('article_url', '')}#{p.get('url_fragment', '')}"
        lines.append(f"[{loc}] (link: {link})\n{p['text']}")
    return "\n\n---\n\n".join(lines)


async def generate_answer(query: str, passages: list[dict]) -> str:
    if not passages:
        return "No relevant passages found. Try rephrasing or ask about a specific Question and Article."

    context = _format_context(passages)
    user_message = (
        f"Retrieved passages from the Summa Theologica:\n\n{context}"
        f"\n\n---\n\nQuestion: {query}"
    )

    client: AsyncOpenAI = get_openai()
    response = await client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        temperature=0.2,
        max_tokens=1500,
    )
    return response.choices[0].message.content or ""
