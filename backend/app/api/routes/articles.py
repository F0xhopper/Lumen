from fastapi import APIRouter, Query

from app.repositories.article_repo import get_articles_for_question

router = APIRouter()


@router.get("/articles")
async def list_articles(
    part_id: str = Query(...),
    question_n: int = Query(..., ge=1),
):
    rows = await get_articles_for_question(part_id, question_n)
    return [{"article_n": r["article_n"], "article_title": r["article_title"]} for r in rows]
