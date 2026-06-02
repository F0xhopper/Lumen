from openai import AsyncOpenAI

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_SYSTEM = (
    "You are generating a short excerpt from the Summa Theologica of St. Thomas Aquinas "
    "that would directly answer the given query. Write 3-5 sentences in the scholastic style "
    "of Aquinas's Respondeo (beginning 'I answer that'). Use precise scholastic vocabulary "
    "consistent with the Summa corpus. Output only the passage — no preamble, no citation."
)


async def generate_hypothesis(query: str, client: AsyncOpenAI) -> str:
    """Return a hypothetical Summa-style passage for HyDE dense-retrieval expansion.

    On failure falls back to the raw query so retrieval still works.
    """
    try:
        resp = await client.chat.completions.create(
            model=settings.HYDE_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": query},
            ],
            temperature=0.0,
            max_tokens=200,
        )
        hypothesis = (resp.choices[0].message.content or "").strip()
        if hypothesis:
            logger.debug("HyDE hypothesis for %r: %s…", query[:40], hypothesis[:80])
            return hypothesis
    except Exception as exc:
        logger.warning("HyDE generation failed (%s) — using raw query for dense embed.", exc)
    return query
