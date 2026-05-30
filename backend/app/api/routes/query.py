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
    _SEARCH_TOOL,
    _build_initial_messages,
    _deduplicate_passages,
    _execute_tool_call,
    _parse_citations_block,
    _passage_to_tool_result,
    run_agent,
)

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

            messages = _build_initial_messages(
                req.query,
                req.pinned_sections,
                req.conversation_history or [],
            )

            for _ in range(_MAX_AGENT_STEPS + 1):
                probe = await client.chat.completions.create(
                    model="gpt-4.1",
                    messages=messages,
                    tools=[_SEARCH_TOOL],  # type: ignore[list-item]
                    tool_choice="auto",
                    temperature=0.2,
                    max_tokens=2500,
                )
                choice = probe.choices[0]
                messages.append(choice.message)  # type: ignore[arg-type]

                if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                    for tc in choice.message.tool_calls:
                        if tc.function.name != "search_summa":
                            continue
                        agent_steps += 1

                        search_query, passages = await _execute_tool_call(
                            tc, req.query, client, article_repo, pinecone_repo
                        )
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Searching: {search_query}'})}\n\n"
                        await asyncio.sleep(0)

                        all_passages.extend(passages)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": _passage_to_tool_result(passages),
                        })
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Found {len(passages)} passages'})}\n\n"
                        await asyncio.sleep(0)
                else:
                    raw_answer = choice.message.content or ""
                    clean_answer, citations = _parse_citations_block(raw_answer, all_passages)

                    chunk_size = 4
                    for i in range(0, len(clean_answer), chunk_size):
                        yield f"data: {json.dumps({'type': 'token', 'text': clean_answer[i:i + chunk_size]})}\n\n"
                        await asyncio.sleep(0)

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
