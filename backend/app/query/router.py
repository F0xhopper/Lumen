import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI, APIConnectionError as OpenAIConnectionError, RateLimitError

from app.articles.repository import ArticleRepository
from app.core.logging import get_logger
from app.infrastructure.database import get_pool
from app.infrastructure.openai import get_openai_client
from app.infrastructure.pinecone import get_pinecone_index
from app.passages.repository import PineconeRepository
from app.passages.schemas import PassageResult
from app.query.schemas import QueryRequest, QueryResponse
from app.query.service import QueryService
from app.services.agent import (
    _MAX_AGENT_STEPS,
    _PASSAGES_PER_SEARCH,
    _SEARCH_TOOL,
    _build_initial_messages,
    _deduplicate_passages,
    _normalize_inline_refs,
    _parse_citations_block,
    _passage_to_tool_result,
)
from app.services.retrieval import combined_search

logger = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


def _get_service(
    pool=Depends(get_pool),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
    pinecone_index=Depends(get_pinecone_index),
) -> QueryService:
    return QueryService(
        article_repo=ArticleRepository(pool),
        pinecone_repo=PineconeRepository(pinecone_index),
        openai_client=openai_client,
    )


@router.post("/", response_model=QueryResponse)
async def query(req: QueryRequest, svc: QueryService = Depends(_get_service)):
    try:
        return await svc.run(
            query=req.query,
            pinned_sections=req.pinned_sections,
            conversation_history=req.conversation_history,
        )
    except RateLimitError as exc:
        logger.error("OpenAI rate limit in query: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit reached. Please try again shortly.")
    except OpenAIConnectionError as exc:
        logger.error("OpenAI connection error in query: %s", exc)
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable. Please try again.")
    except Exception as exc:
        logger.error("Query failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/stream")
async def query_stream(
    req: QueryRequest,
    pool=Depends(get_pool),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
    pinecone_index=Depends(get_pinecone_index),
):
    article_repo = ArticleRepository(pool)
    pinecone_repo = PineconeRepository(pinecone_index)

    async def event_stream():
        try:
            all_passages: list[PassageResult] = []
            agent_steps = 0
            CITATIONS_MARKER = "```citations"

            messages = _build_initial_messages(
                req.query,
                req.pinned_sections,
                req.conversation_history or [],
            )

            yield f"data: {json.dumps({'type': 'status', 'message': 'Thinking…'})}\n\n"
            await asyncio.sleep(0)

            for _ in range(_MAX_AGENT_STEPS + 1):
                stream = await openai_client.chat.completions.create(
                    model="gpt-4.1",
                    messages=messages,
                    tools=[_SEARCH_TOOL],  # type: ignore[list-item]
                    tool_choice="auto",
                    temperature=0.2,
                    max_tokens=2500,
                    stream=True,
                )

                tc_acc: dict[int, dict] = {}
                full_text = ""
                is_text: bool | None = None
                line_buf = ""
                stop_streaming = False

                async for chunk in stream:
                    delta = chunk.choices[0].delta
                    if delta.tool_calls:
                        is_text = False
                        for tcd in delta.tool_calls:
                            idx = tcd.index
                            if idx not in tc_acc:
                                tc_acc[idx] = {"id": "", "name": "", "arguments": ""}
                            if tcd.id:
                                tc_acc[idx]["id"] = tcd.id
                            if tcd.function:
                                if tcd.function.name:
                                    tc_acc[idx]["name"] += tcd.function.name
                                if tcd.function.arguments:
                                    tc_acc[idx]["arguments"] += tcd.function.arguments
                    elif delta.content is not None:
                        is_text = True
                        full_text += delta.content
                        if not stop_streaming:
                            line_buf += delta.content
                            while "\n" in line_buf:
                                nl = line_buf.index("\n")
                                line = line_buf[: nl + 1]
                                line_buf = line_buf[nl + 1:]
                                if line.strip().startswith(CITATIONS_MARKER):
                                    stop_streaming = True
                                    line_buf = ""
                                    break
                                yield f"data: {json.dumps({'type': 'token', 'text': _normalize_inline_refs(line)})}\n\n"
                                await asyncio.sleep(0)

                if is_text is False and tc_acc:
                    tool_calls = [
                        {"id": tc_acc[i]["id"], "type": "function",
                         "function": {"name": tc_acc[i]["name"], "arguments": tc_acc[i]["arguments"]}}
                        for i in sorted(tc_acc)
                    ]
                    messages.append({"role": "assistant", "content": None, "tool_calls": tool_calls})

                    for tc in tool_calls:
                        if tc["function"]["name"] != "search_summa":
                            continue
                        agent_steps += 1
                        try:
                            preview_query = json.loads(tc["function"]["arguments"]).get("query", req.query)
                        except Exception:
                            preview_query = req.query
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Searching: {preview_query}'})}\n\n"
                        await asyncio.sleep(0)
                        try:
                            args = json.loads(tc["function"]["arguments"])
                            search_query = args.get("query", req.query)
                            top_k = min(int(args.get("top_k", _PASSAGES_PER_SEARCH)), 10)
                        except (json.JSONDecodeError, ValueError):
                            search_query = req.query
                            top_k = _PASSAGES_PER_SEARCH
                        passages = await combined_search(
                            search_query,
                            client=openai_client,
                            article_repo=article_repo,
                            pinecone_repo=pinecone_repo,
                            top_k=top_k,
                        )
                        all_passages.extend(passages)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": _passage_to_tool_result(passages),
                        })
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Found {len(passages)} passages — writing answer…'})}\n\n"
                        await asyncio.sleep(0)

                elif is_text is True:
                    if not stop_streaming and line_buf and not line_buf.strip().startswith(CITATIONS_MARKER):
                        yield f"data: {json.dumps({'type': 'token', 'text': _normalize_inline_refs(line_buf)})}\n\n"
                        await asyncio.sleep(0)
                    _, citations = _parse_citations_block(full_text, all_passages)
                    yield f"data: {json.dumps({'type': 'done', 'citations': [c.model_dump() for c in citations], 'passages_used': len(_deduplicate_passages(all_passages)), 'agent_steps': agent_steps})}\n\n"
                    return

            yield f"data: {json.dumps({'type': 'error', 'message': 'Agent search limit reached'})}\n\n"

        except RateLimitError as exc:
            logger.error("OpenAI rate limit in stream: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI service rate limit reached. Please try again shortly.'})}\n\n"
        except OpenAIConnectionError as exc:
            logger.error("OpenAI connection error in stream: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI service temporarily unavailable. Please try again.'})}\n\n"
        except Exception as exc:
            logger.error("Stream error: %s", exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error. Please try again.'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
