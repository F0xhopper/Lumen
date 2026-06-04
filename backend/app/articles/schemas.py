from pydantic import BaseModel

from app.articles.domain import Article, ArticleSummary, SectionItem as DomainSectionItem


class SectionItemResponse(BaseModel):
    n: int
    text: str

    @classmethod
    def from_domain(cls, s: DomainSectionItem) -> "SectionItemResponse":
        return cls(n=s.n, text=s.text)


class ArticleSummaryResponse(BaseModel):
    article_n: int
    article_title: str

    @classmethod
    def from_domain(cls, s: ArticleSummary) -> "ArticleSummaryResponse":
        return cls(article_n=s.article_n, article_title=s.article_title)


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
    objections: list[SectionItemResponse] = []
    replies: list[SectionItemResponse] = []
    source_url: str | None = None
    body_la: str | None = None
    sed_contra_la: str | None = None
    respondeo_la: str | None = None
    objections_la: list[SectionItemResponse] = []
    replies_la: list[SectionItemResponse] = []
    source_url_la: str | None = None

    @classmethod
    def from_domain(cls, a: Article) -> "ArticleResponse":
        return cls(
            part_id=a.part_id,
            part_abbr=a.part_abbr,
            question_n=a.question_n,
            question_title=a.question_title,
            article_n=a.article_n,
            article_title=a.article_title,
            body=a.body,
            sed_contra=a.sed_contra,
            respondeo=a.respondeo,
            objections=[SectionItemResponse.from_domain(s) for s in a.objections],
            replies=[SectionItemResponse.from_domain(s) for s in a.replies],
            source_url=a.source_url,
            body_la=a.body_la,
            sed_contra_la=a.sed_contra_la,
            respondeo_la=a.respondeo_la,
            objections_la=[SectionItemResponse.from_domain(s) for s in a.objections_la],
            replies_la=[SectionItemResponse.from_domain(s) for s in a.replies_la],
            source_url_la=a.source_url_la,
        )
