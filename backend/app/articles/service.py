from app.articles.domain import Article, ArticleSummary
from app.articles.repository import ArticleRepository


class ArticleNotFoundError(Exception):
    def __init__(self, part_id: str, question_n: int, article_n: int) -> None:
        super().__init__(f"Article not found: {part_id} Q.{question_n} A.{article_n}")


class ArticleService:
    def __init__(self, repo: ArticleRepository) -> None:
        self._repo = repo

    async def get_article(self, part_id: str, question_n: int, article_n: int) -> Article:
        article = await self._repo.get_article(part_id, question_n, article_n)
        if article is None:
            raise ArticleNotFoundError(part_id, question_n, article_n)
        return article

    async def list_articles_for_question(self, part_id: str, question_n: int) -> list[ArticleSummary]:
        return await self._repo.get_articles_for_question(part_id, question_n)
