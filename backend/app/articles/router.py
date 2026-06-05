from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.articles.repository import ArticleRepository
from app.articles.schemas import ArticleResponse, ArticleSummaryResponse
from app.articles.service import ArticleNotFoundError, ArticleService
from app.core.logging import get_logger
from app.infrastructure.database import get_pool

logger = get_logger(__name__)

router = APIRouter(prefix="/articles", tags=["articles"])


def _get_service(pool=Depends(get_pool)) -> ArticleService:
    return ArticleService(ArticleRepository(pool))


@router.get("/", response_model=list[ArticleSummaryResponse])
async def list_articles(
    part_id: str = Query(...),
    question_n: int = Query(..., ge=1),
    svc: ArticleService = Depends(_get_service),
):
    summaries = await svc.list_articles_for_question(part_id, question_n)
    return [ArticleSummaryResponse.from_domain(s) for s in summaries]


@router.get("/{part_id}/{question_n}/{article_n}", response_model=ArticleResponse)
async def get_article(
    part_id: str,
    question_n: int,
    article_n: int,
    svc: ArticleService = Depends(_get_service),
):
    try:
        article = await svc.get_article(part_id, question_n, article_n)
        return ArticleResponse.from_domain(article)
    except ArticleNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Article fetch failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
