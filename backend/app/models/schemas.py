from pydantic import BaseModel


class SectionItem(BaseModel):
    n: int
    text: str


class PassageResult(BaseModel):
    rank: int
    text: str
    score: float
    part_abbr: str
    question_n: int
    article_n: int
    question_title: str
    article_title: str
    section: str
    section_label: str
    url_fragment: str
    article_url: str
    source_url: str


class ArticleResponse(BaseModel):
    part_id: str
    part_abbr: str
    question_n: int
    question_title: str
    article_n: int
    article_title: str
    body: str
    sed_contra: str | None = None
    respondeo: str | None = None
    objections: list[SectionItem] = []
    replies: list[SectionItem] = []
    source_url: str | None = None
    body_la: str | None = None
    sed_contra_la: str | None = None
    respondeo_la: str | None = None
    objections_la: list[SectionItem] = []
    replies_la: list[SectionItem] = []
    source_url_la: str | None = None


class ArticleSummary(BaseModel):
    article_n: int
    article_title: str


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
