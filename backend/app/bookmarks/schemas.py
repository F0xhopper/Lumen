from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.bookmarks.domain import Bookmark


class BookmarkCreateRequest(BaseModel):
    part_id: str
    question_n: int
    article_n: int | None = None
    label: str | None = None
    folder: str | None = None


class BookmarkMoveRequest(BaseModel):
    folder: str | None  # None = remove from folder (uncategorized)


class BookmarkResponse(BaseModel):
    id: UUID
    part_id: str
    question_n: int
    article_n: int | None
    label: str | None
    folder: str | None
    created_at: datetime

    @classmethod
    def from_domain(cls, b: Bookmark) -> "BookmarkResponse":
        return cls(
            id=b.id,
            part_id=b.part_id,
            question_n=b.question_n,
            article_n=b.article_n,
            label=b.label,
            folder=b.folder,
            created_at=b.created_at,
        )
