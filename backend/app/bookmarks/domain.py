from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class Bookmark:
    """Core domain entity — no HTTP or DB concerns."""

    id: UUID
    user_id: str
    part_id: str
    question_n: int
    article_n: int | None
    label: str | None
    folder: str | None
    created_at: datetime
