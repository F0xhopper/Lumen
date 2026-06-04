from dataclasses import dataclass, field

from app.passages.domain import Passage


@dataclass
class QueryResult:
    answer: str
    passages_used: int
    agent_steps: int
    citations: list = field(default_factory=list)
