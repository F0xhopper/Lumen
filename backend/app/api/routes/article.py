import json
from fastapi import APIRouter, Query, HTTPException

from app.repositories.article_repo import get_article
from app.models.schemas import ArticleResponse, SectionItem

router = APIRouter()


@router.get("/article", response_model=ArticleResponse)
async def fetch_article(
    part_id: str = Query(...),
    question_n: int = Query(..., ge=1),
    article_n: int = Query(..., ge=1),
):
    row = await get_article(part_id, question_n, article_n)
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")

    d = dict(row)
    for field in ("objections", "replies", "objections_la", "replies_la"):
        raw = d.get(field)
        if isinstance(raw, str):
            d[field] = [SectionItem(**item) for item in json.loads(raw)]
        elif isinstance(raw, list):
            d[field] = [SectionItem(**item) for item in raw]
        else:
            d[field] = []

    return d
