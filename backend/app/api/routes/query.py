import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from app.core.dependencies import get_article_repo, get_openai, get_pinecone_repo
from app.core.logging import get_logger
from app.models.schemas import PassageResult, QueryRequest, QueryResponse
from app.repositories.article_repo import ArticleRepository
from app.repositories.pinecone_repo import PineconeRepository
from app.services.agent import (
    _MAX_AGENT_STEPS,
    _PASSAGES_PER_SEARCH,
    _SEARCH_TOOL,
    _build_initial_messages,
    _deduplicate_passages,
    _normalize_inline_refs,
    _parse_citations_block,
    _passage_to_tool_result,
    run_agent,
)
from app.services.retrieval import combined_search

logger = get_logger(__name__)
router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query(
    req: QueryRequest,
    client: AsyncOpenAI = Depends(get_openai),
    pinecone_repo: PineconeRepository = Depends(get_pinecone_repo),
    article_repo: ArticleRepository = Depends(get_article_repo),
):
    try:
        result = await run_agent(
            query=req.query,
            client=client,
            pinecone_repo=pinecone_repo,
            article_repo=article_repo,
            pinned_sections=req.pinned_sections,
            conversation_history=req.conversation_history,
        )
        return QueryResponse(
            answer=result.answer,
            citations=result.citations,
            passages_used=result.passages_used,
            agent_steps=result.agent_steps,
        )
    except Exception as e:
        logger.error("Error in POST /query: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/query/stream")
async def query_stream(
    req: QueryRequest,
    client: AsyncOpenAI = Depends(get_openai),
    pinecone_repo: PineconeRepository = Depends(get_pinecone_repo),
    article_repo: ArticleRepository = Depends(get_article_repo),
):
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
                stream = await client.chat.completions.create(
                    model="gpt-4.1",
                    messages=messages,
                    tools=[_SEARCH_TOOL],  # type: ignore[list-item]
                    tool_choice="auto",
                    temperature=0.2,
                    max_tokens=2500,
                    stream=True,
                )

                # Accumulate tool call deltas; stream text tokens line-by-line.
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
                            # Emit complete lines; stop at the citations fence.
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
                        {
                            "id": tc_acc[i]["id"],
                            "type": "function",
                            "function": {
                                "name": tc_acc[i]["name"],
                                "arguments": tc_acc[i]["arguments"],
                            },
                        }
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

                        logger.info("Agent stream search: %r top_k=%d", search_query, top_k)
                        passages = await combined_search(
                            search_query,
                            client=client,
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
                    # Flush any trailing partial line that has no trailing newline.
                    if not stop_streaming and line_buf and not line_buf.strip().startswith(CITATIONS_MARKER):
                        yield f"data: {json.dumps({'type': 'token', 'text': _normalize_inline_refs(line_buf)})}\n\n"
                        await asyncio.sleep(0)

                    _, citations = _parse_citations_block(full_text, all_passages)
                    yield f"data: {json.dumps({'type': 'done', 'citations': [c.model_dump() for c in citations], 'passages_used': len(_deduplicate_passages(all_passages)), 'agent_steps': agent_steps})}\n\n"
                    return

            yield f"data: {json.dumps({'type': 'error', 'message': 'Agent search limit reached'})}\n\n"

        except Exception as e:
            logger.error("Error in POST /query/stream: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
