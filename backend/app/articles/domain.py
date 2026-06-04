from dataclasses import dataclass, field


@dataclass(frozen=True)
class SectionItem:
    n: int
    text: str


@dataclass(frozen=True)
class ArticleSummary:
    article_n: int
    article_title: str


@dataclass
class Article:
    part_id: str
    part_abbr: str
    question_n: int
    question_title: str
    article_n: int
    article_title: str
    body: str
    sed_contra: str | None = None
    respondeo: str | None = None
    objections: list[SectionItem] = field(default_factory=list)
    replies: list[SectionItem] = field(default_factory=list)
    source_url: str | None = None
    body_la: str | None = None
    sed_contra_la: str | None = None
    respondeo_la: str | None = None
    objections_la: list[SectionItem] = field(default_factory=list)
    replies_la: list[SectionItem] = field(default_factory=list)
    source_url_la: str | None = None
