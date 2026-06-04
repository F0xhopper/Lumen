from app.history.domain import HistoryEntry
from app.history.repository import HistoryRepository


class HistoryService:
    def __init__(self, repo: HistoryRepository) -> None:
        self._repo = repo

    async def list_history(self, user_id: str) -> list[HistoryEntry]:
        return await self._repo.list(user_id)

    async def record_visit(
        self,
        *,
        user_id: str,
        part_id: str,
        question_n: int,
        article_n: int | None,
    ) -> HistoryEntry:
        return await self._repo.record(
            user_id=user_id,
            part_id=part_id,
            question_n=question_n,
            article_n=article_n,
        )

    async def clear_history(self, user_id: str) -> None:
        await self._repo.clear(user_id)
