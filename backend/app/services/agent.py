import json
import re
from dataclasses import dataclass

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas import CitationResult, ConversationTurn, PassageResult, PinnedSection
from app.repositories.pinecone_repo import PineconeRepository
from app.services.retrieval import combined_search

logger = get_logger(__name__)

_MAX_AGENT_STEPS = 3
_PASSAGES_PER_SEARCH = 6
_PASSAGE_MAX_CHARS = 1800
_TOOL_RESULT_MAX_CHARS = 8000
_HISTORY_TURNS = 6

_VALID_PART_ABBRS = frozenset({"I", "I-II", "II-II", "III"})

_PART_TO_SLUG: dict[str, str] = {
    "I": "1",
    "I-II": "1-2",
    "II-II": "2-2",
    "III": "3",
}

_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_summa",
        "description": (
            "Search the Summa Theologica for relevant passages. "
            "Call with a focused query. You may call this up to 3 times with different "
            "angles (e.g. the main topic, a specific objection, a related concept) "
            "to gather sufficient evidence before writing your answer."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Targeted search query (2–10 words)",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of passages to retrieve (default 6, max 10)",
                    "default": 6,
                },
            },
            "required": ["query"],
        },
    },
}

_SYSTEM_PROMPT = """\
You are a scholarly assistant for advanced study of the Summa Theologica of St. Thomas Aquinas. \
Your interlocutors are theologians, philosophers, and serious students who know the text. \
Your role is to give them Aquinas's own words, precisely located and honestly framed.

## WORKFLOW

1. Call search_summa with a focused query. Call it up to 3 times with different angles \
(e.g. the principal term, a key objection, a related question or parallel locus) to gather sufficient evidence.
2. Write your answer grounded solely in the retrieved passages. Every substantive claim must be \
anchored to a direct quotation — no paraphrase dressed as quotation, no reconstruction from memory.
3. If the retrieved passages do not directly address the question, say so plainly. Name the \
article(s) the user should consult (e.g. "This is treated directly in ST I, q.75, a.2") rather \
than summarising from training data.
4. Append a citations block in the exact format below. Output nothing after it.

## READING CONTEXT SIGNALS

The user's message may open with one or more signals:

**[Viewing: ST I Q.2 — "Whether God exists"]**
→ The user is reading this article. Direct your first search_summa call at it. \
Treat vague follow-up questions as about it unless stated otherwise.

**[Quote: "…text…" (ST I Q.2 A.3 — respondeo)]**
→ The user highlighted this passage. Search its immediate context first; quote it back where directly relevant.

When both appear, the quote is the sharper focus.

## HOW TO WRITE YOUR ANSWER

### Structure
Mirror the Summa's own dialectical form where the question warrants it. Use `###` markdown \
headers for section labels — **exactly** as shown:

```
### RESPONDEO
### SED CONTRA
### OBJ. 1 / AD 1
### OBJ. 2 / AD 2
```

- **RESPONDEO** (*I answer that*) — Aquinas's definitive position; quote this first and fully.
- **SED CONTRA** (*On the contrary*) — the authoritative text he stands on; shows the tradition behind him.
- **OBJ. N / AD N** — the objections and replies; quote to show the full dialectic. \
  Never attribute an Objection to Aquinas — he is presenting the best case for the opposing view.

For simpler questions a full structured response is unnecessary; use prose with `###` headings.

### Quotation
Lead with Aquinas's own words in a blockquote before any commentary:

> "I answer that, the existence of God can be proved in five ways…" *(ST I, q.2, a.3, resp.)* [1]

Every passage you draw on gets an **[N]** inline marker (N = 1, 2, 3 … in order of first use) \
**and** a parenthetical locus in standard notation: *(ST part, q.N, a.N, resp.)* / *(ad 1)* / *(obj. 2)* etc.

### Latin
Include Latin for all technical terms on first use: *esse* (act of being), *essentia* (essence), \
*suppositum* (supposit), *actus purus* (pure act), *forma* (form), *materia* (matter), \
*potentia* (potency), *participatio* (participation), *analogia entis* (analogy of being), etc. \
When quoting a Sed Contra that cites Scripture or another authority, name that source explicitly \
(e.g. "citing Augustine, *De Trinitate* I" or "following Aristotle, *Metaphysics* XII").

### Interlocutors
Name Aquinas's philosophical and theological sources when they appear: Aristotle, Averroes, \
Avicenna, Augustine, Pseudo-Dionysius, Boethius, Peter Lombard, Maimonides. \
Note where Aquinas is synthesising, correcting, or departing from them — this is what \
distinguishes his position from his sources.

### Precision
- Real distinction vs. logical distinction (*distinctio realis* vs. *distinctio rationis*) — \
  mark which is operative.
- Distinguish the order of knowing (*ordo cognoscendi*) from the order of being (*ordo essendi*) \
  when relevant.
- Do not use "subsistence," "essence," "nature," "person," "substance" loosely — \
  gloss each term when introduced.

## CITATION FORMAT

At the very end output exactly this block, then stop.

```citations
1|I|2|3|respondeo|I answer that|Whether God exists|The existence of God
2|I|2|3|sed_contra|On the contrary|Whether God exists|The existence of God
3|I-II|90|1|respondeo|I answer that|Whether law is something pertaining to reason|Of the Essence of Law
```

**Fields (pipe-separated):** ref_number | part_abbr | question_n | article_n | section | section_label | article_title | question_title

**Rules:**
- Copy part_abbr, question_n, article_n, section, section_label, article_title, question_title \
  **exactly** from the `[PASSAGE|…]` headers you received — never paraphrase or guess.
- ref_number must match the [N] marker used inline.
- One line per cited passage; no duplicate ref numbers.
- Valid part_abbr values: `I`, `I-II`, `II-II`, `III`.
"""


@dataclass
class AgentResult:
    answer: str
    citations: list[CitationResult]
    passages_used: int
    agent_steps: int


def _url_path(part_abbr: str, question_n: int, article_n: int, url_fragment: str) -> str:
    slug = _PART_TO_SLUG.get(part_abbr, part_abbr.lower())
    return f"/{slug}/{question_n}/{article_n}#{url_fragment}"


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + " …[truncated]"


def _normalize_inline_refs(text: str) -> str:
    return re.sub(r"\[\[(\d+)\]\]", r"[\1]", text)


def _format_pinned(pinned: list[PinnedSection]) -> str:
    if not pinned:
        return ""
    lines = ["## Pinned sections (treat as high-priority context)\n"]
    for p in pinned:
        loc = f"ST {p.part_abbr} Q.{p.question_n} A.{p.article_n} — {p.section_label}"
        lines.append(f"[{loc}]\n{p.text}")
    return "\n\n".join(lines)


def _passage_to_tool_result(passages: list[PassageResult]) -> str:
    if not passages:
        return "No passages found for that query."
    lines = []
    for p in passages:
        loc = f"ST {p.part_abbr} Q.{p.question_n} A.{p.article_n} — {p.section_label}"
        body = _truncate(p.text, _PASSAGE_MAX_CHARS)
        lines.append(
            f"[PASSAGE|{p.part_abbr}|{p.question_n}|{p.article_n}"
            f"|{p.section}|{p.section_label}|{p.article_title}|{p.question_title}]\n"
            f"Location: {loc}\n"
            f"{body}"
        )
    return _truncate("\n\n---\n\n".join(lines), _TOOL_RESULT_MAX_CHARS)


def _deduplicate_passages(passages: list[PassageResult]) -> list[PassageResult]:
    seen: set[tuple] = set()
    out: list[PassageResult] = []
    for p in passages:
        key = (p.part_abbr, p.question_n, p.article_n, p.section)
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def _build_initial_messages(
    query: str,
    pinned_sections: list[PinnedSection],
    conversation_history: list[ConversationTurn],
) -> list[ChatCompletionMessageParam]:
    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": _SYSTEM_PROMPT},
    ]
    for turn in conversation_history[-_HISTORY_TURNS:]:
        messages.append({"role": turn.role, "content": turn.content})  # type: ignore[misc]

    user_parts: list[str] = []
    if pinned_sections:
        user_parts.append(_format_pinned(pinned_sections))
    user_parts.append(f"Question: {query}")
    messages.append({"role": "user", "content": "\n\n".join(user_parts)})
    return messages


def _last_assistant_content(messages: list[ChatCompletionMessageParam]) -> str:
    for m in reversed(messages):
        if isinstance(m, dict) and m.get("role") == "assistant":
            return m.get("content") or ""  # type: ignore[return-value]
        if hasattr(m, "role") and getattr(m, "role") == "assistant":
            return getattr(m, "content", None) or ""
    return ""


_CITATIONS_RE = re.compile(r"```citations[ \t]*\n(.*?)```", re.DOTALL | re.IGNORECASE)


def _match_passage(
    part_abbr: str,
    question_n: int,
    article_n: int,
    section: str,
    all_passages: list[PassageResult],
) -> PassageResult | None:
    for p in all_passages:
        if (
            p.part_abbr == part_abbr
            and p.question_n == question_n
            and p.article_n == article_n
            and p.section == section
        ):
            return p
    return None


def _parse_citation_line(
    line: str,
    seen_refs: set[str],
    all_passages: list[PassageResult],
) -> CitationResult | None:
    fields = [f.strip().strip("`") for f in line.split("|")]
    if len(fields) < 5:
        logger.warning("Citation line too short (skipped): %r", line)
        return None

    ref            = fields[0]
    part_abbr      = fields[1]
    q_raw          = fields[2]
    a_raw          = fields[3]
    section        = fields[4]
    section_label  = fields[5] if len(fields) > 5 else section.replace("_", " ").title()
    article_title  = fields[6] if len(fields) > 6 else ""
    question_title = fields[7] if len(fields) > 7 else ""

    if ref in seen_refs:
        return None
    if part_abbr not in _VALID_PART_ABBRS:
        logger.warning("Unknown part_abbr %r in citation (skipped): %r", part_abbr, line)
        return None

    try:
        question_n = int(q_raw)
        article_n  = int(a_raw)
    except ValueError:
        logger.warning("Non-integer q/a in citation (skipped): %r", line)
        return None

    url_fragment = section.replace("_", "-")
    matched = _match_passage(part_abbr, question_n, article_n, section, all_passages)
    if matched:
        url_fragment   = matched.url_fragment
        article_title  = article_title  or matched.article_title
        question_title = question_title or matched.question_title

    return CitationResult(
        ref=ref,
        part_abbr=part_abbr,
        question_n=question_n,
        article_n=article_n,
        section=section,
        section_label=section_label,
        article_title=article_title,
        question_title=question_title,
        url_path=_url_path(part_abbr, question_n, article_n, url_fragment),
    )


def _parse_citations_block(
    text: str,
    all_passages: list[PassageResult],
) -> tuple[str, list[CitationResult]]:
    match = _CITATIONS_RE.search(text)
    if not match:
        logger.warning("No citations block found in agent response")
        return _normalize_inline_refs(text.strip()), []

    raw_block = match.group(1).strip()
    clean_answer = _normalize_inline_refs(
        text[: match.start()].rstrip().rstrip("-").rstrip()
    )

    citations: list[CitationResult] = []
    seen_refs: set[str] = set()

    for line in raw_block.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        citation = _parse_citation_line(line, seen_refs, all_passages)
        if citation:
            seen_refs.add(citation.ref)
            citations.append(citation)

    return clean_answer, citations


async def _execute_tool_call(
    tc,
    fallback_query: str,
    client: AsyncOpenAI,
    article_repo,
    pinecone_repo: PineconeRepository,
) -> tuple[str, list[PassageResult]]:
    try:
        args = json.loads(tc.function.arguments)
        search_query = args.get("query", fallback_query)
        top_k = min(int(args.get("top_k", _PASSAGES_PER_SEARCH)), 10)
    except (json.JSONDecodeError, ValueError):
        search_query = fallback_query
        top_k = _PASSAGES_PER_SEARCH

    logger.info("Agent search: %r top_k=%d", search_query, top_k)
    passages = await combined_search(
        search_query,
        client=client,
        article_repo=article_repo,
        pinecone_repo=pinecone_repo,
        top_k=top_k,
    )
    return search_query, passages


async def run_agent(
    query: str,
    client: AsyncOpenAI,
    pinecone_repo: PineconeRepository,
    article_repo,
    pinned_sections: list[PinnedSection] | None = None,
    conversation_history: list[ConversationTurn] | None = None,
) -> AgentResult:
    pinned_sections = pinned_sections or []
    conversation_history = conversation_history or []

    all_passages: list[PassageResult] = []
    agent_steps = 0

    messages = _build_initial_messages(query, pinned_sections, conversation_history)

    for _ in range(_MAX_AGENT_STEPS + 1):  # +1 for the final synthesis pass
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=messages,
            tools=[_SEARCH_TOOL],  # type: ignore[list-item]
            tool_choice="auto",
            temperature=0.2,
            max_tokens=2500,
        )

        choice = response.choices[0]
        messages.append(choice.message)  # type: ignore[arg-type]

        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                if tc.function.name != "search_summa":
                    continue
                agent_steps += 1
                _, passages = await _execute_tool_call(
                    tc, query, client, article_repo, pinecone_repo
                )
                all_passages.extend(passages)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": _passage_to_tool_result(passages),
                })
        else:
            raw_answer = choice.message.content or ""
            clean_answer, citations = _parse_citations_block(raw_answer, all_passages)
            return AgentResult(
                answer=clean_answer,
                citations=citations,
                passages_used=len(_deduplicate_passages(all_passages)),
                agent_steps=agent_steps,
            )

    raw_answer = _last_assistant_content(messages)
    clean_answer, citations = _parse_citations_block(raw_answer, all_passages)
    return AgentResult(
        answer=clean_answer or "Agent reached the search limit without a final answer. Please try rephrasing.",
        citations=citations,
        passages_used=len(_deduplicate_passages(all_passages)),
        agent_steps=agent_steps,
    )
