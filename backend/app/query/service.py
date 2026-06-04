from openai import AsyncOpenAI

from app.articles.repository import ArticleRepository
from app.passages.repository import PineconeRepository
from app.query.schemas import ConversationTurn, PinnedSection, QueryResponse
from app.services.agent import run_agent


class QueryService:
    def __init__(
        self,
        article_repo: ArticleRepository,
        pinecone_repo: PineconeRepository,
        openai_client: AsyncOpenAI,
    ) -> None:
        self._article_repo = article_repo
        self._pinecone_repo = pinecone_repo
        self._client = openai_client

    async def run(
        self,
        query: str,
        pinned_sections: list[PinnedSection],
        conversation_history: list[ConversationTurn],
    ) -> QueryResponse:
        result = await run_agent(
            query=query,
            client=self._client,
            pinecone_repo=self._pinecone_repo,
            article_repo=self._article_repo,
            pinned_sections=pinned_sections,
            conversation_history=conversation_history,
        )
        return QueryResponse(
            answer=result.answer,
            citations=result.citations,
            passages_used=result.passages_used,
            agent_steps=result.agent_steps,
        )
