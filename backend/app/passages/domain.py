from dataclasses import dataclass


@dataclass(frozen=True)
class Passage:
    """A scored section of a Summa article returned by search."""

    text: str
    score: float
    rank: int
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


@dataclass(frozen=True)
class QuestionMatch:
    rank: int
    score: float
    part_id: str
    part_abbr: str
    question_n: int
    question_title: str
