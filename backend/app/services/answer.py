from openai import AsyncOpenAI

from app.models.schemas import PassageResult


def _format_context(passages: list[PassageResult]) -> str:
    lines = []
    for p in passages:
        loc = f"ST {p.part_abbr} Q.{p.question_n} A.{p.article_n} — {p.section_label}"
        link = f"{p.article_url}#{p.url_fragment}"
        lines.append(f"[{loc}] (link: {link})\n{p.text}")
    return "\n\n---\n\n".join(lines)


async def generate_answer(
    query: str, passages: list[PassageResult], client: AsyncOpenAI
) -> str:
    if not passages:
        return "No relevant passages found. Try rephrasing or ask about a specific Question and Article."

    from app.core.config import settings

    context = _format_context(passages)
    user_message = (
        f"Retrieved passages from the Summa Theologica:\n\n{context}"
        f"\n\n---\n\nQuestion: {query}"
    )
    response = await client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=[
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        max_tokens=1500,
    )
    return response.choices[0].message.content or ""
