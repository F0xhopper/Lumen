from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class HistoryEntry:
    """Core domain entity — no HTTP or DB concerns."""

    id: UUID
    user_id: str
    part_id: str
    question_n: int
    article_n: int | None
    visited_at: datetime
