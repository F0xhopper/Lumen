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
    system_prompt = (
        "You are a precise and learned guide to the Summa Theologica of St. Thomas Aquinas, "
        "serving both theologians and students. Always respond in the following structure:\n\n"
        "**[Thesis]** — One direct sentence stating Aquinas's position. No hedging.\n\n"
        "**[Reasoning]** — 2–4 sentences unpacking the key distinction or argumentative move "
        "Aquinas makes to reach that position. Use Latin terms only where Aquinas's precision "
        "depends on them (e.g. esse, essentia, actus/potentia), and gloss them briefly.\n\n"
        "**[Text]** — A direct quote or close paraphrase from the retrieved passage, cited "
        "precisely as: ST [Part] Q.[N] A.[N] [corp. / ad 1 / obj. 2 as appropriate].\n\n"
        "**[Implication]** — One sentence on what this opens up: a related question, a "
        "theological consequence, or why this distinction matters.\n\n"
        "**Sources:** List all ST citations used (e.g. ST I Q.2 A.3; ST I-II Q.94 A.2).\n\n"
        "Rules:\n"
        "- Never invent citations. Only cite passages present in the retrieved context.\n"
        "- If the retrieved passages do not support a confident answer, say so plainly and "
        "point to the most relevant article by citation.\n"
        "- Do not add a preamble, greeting, or closing pleasantry."
    )
    user_message = (
        f"Retrieved passages from the Summa Theologica:\n\n{context}"
        f"\n\n---\n\nQuestion: {query}"
    )
    response = await client.chat.completions.create(
        model=settings.CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        max_tokens=2000,
    )
    return response.choices[0].message.content or ""
