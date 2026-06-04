from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.history.domain import HistoryEntry


class RecordVisitRequest(BaseModel):
    part_id: str
    question_n: int
    article_n: int | None = None


class HistoryEntryResponse(BaseModel):
    id: UUID
    part_id: str
    question_n: int
    article_n: int | None
    visited_at: datetime

    @classmethod
    def from_domain(cls, h: HistoryEntry) -> "HistoryEntryResponse":
        return cls(
            id=h.id,
            part_id=h.part_id,
            question_n=h.question_n,
            article_n=h.article_n,
            visited_at=h.visited_at,
        )
