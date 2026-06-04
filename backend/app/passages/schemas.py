from pydantic import BaseModel

from app.passages.domain import Passage, QuestionMatch


# PassageResult is kept as a Pydantic model (not just a dataclass) because the
# internal retrieval services use Pydantic's .model_copy() for score updates.
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

    @classmethod
    def from_domain(cls, p: Passage) -> "PassageResult":
        return cls(
            rank=p.rank,
            text=p.text,
            score=p.score,
            part_abbr=p.part_abbr,
            question_n=p.question_n,
            article_n=p.article_n,
            question_title=p.question_title,
            article_title=p.article_title,
            section=p.section,
            section_label=p.section_label,
            url_fragment=p.url_fragment,
            article_url=p.article_url,
            source_url=p.source_url,
        )


class QuestionResult(BaseModel):
    rank: int
    score: float
    part_id: str
    part_abbr: str
    question_n: int
    question_title: str

    @classmethod
    def from_domain(cls, q: QuestionMatch) -> "QuestionResult":
        return cls(
            rank=q.rank,
            score=q.score,
            part_id=q.part_id,
            part_abbr=q.part_abbr,
            question_n=q.question_n,
            question_title=q.question_title,
        )
