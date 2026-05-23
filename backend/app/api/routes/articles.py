from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_article_repo
from app.models.schemas import ArticleSummary
from app.repositories.article_repo import ArticleRepository

router = APIRouter()


@router.get("/articles", response_model=list[ArticleSummary])
async def list_articles(
    part_id: str = Query(...),
    question_n: int = Query(..., ge=1),
    repo: ArticleRepository = Depends(get_article_repo),
):
    return await repo.get_articles_for_question(part_id, question_n)
