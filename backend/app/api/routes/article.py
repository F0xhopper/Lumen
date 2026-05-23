from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_article_repo
from app.models.schemas import ArticleResponse
from app.repositories.article_repo import ArticleRepository

router = APIRouter()


@router.get("/article", response_model=ArticleResponse)
async def fetch_article(
    part_id: str = Query(...),
    question_n: int = Query(..., ge=1),
    article_n: int = Query(..., ge=1),
    repo: ArticleRepository = Depends(get_article_repo),
):
    article = await repo.get_article(part_id, question_n, article_n)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article
