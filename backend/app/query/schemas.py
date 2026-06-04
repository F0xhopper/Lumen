from pydantic import BaseModel

from app.passages.schemas import PassageResult


class CitationResult(BaseModel):
    ref: str
    part_abbr: str
    question_n: int
    article_n: int
    section: str
    section_label: str
    article_title: str
    question_title: str
    url_path: str


class PinnedSection(BaseModel):
    part_abbr: str
    question_n: int
    article_n: int
    section: str
    section_label: str
    article_title: str
    question_title: str
    url_path: str
    text: str


class ConversationTurn(BaseModel):
    role: str
    content: str


class QueryRequest(BaseModel):
    query: str
    pinned_sections: list[PinnedSection] = []
    conversation_history: list[ConversationTurn] = []


class QueryResponse(BaseModel):
    answer: str
    citations: list[CitationResult] = []
    passages_used: int
    agent_steps: int = 1
