from app.bookmarks.domain import Bookmark
from app.bookmarks.repository import BookmarkRepository


class BookmarkNotFoundError(Exception):
    def __init__(self, bookmark_id: str) -> None:
        super().__init__(f"Bookmark {bookmark_id!r} not found")
        self.bookmark_id = bookmark_id


class BookmarkService:
    def __init__(self, repo: BookmarkRepository) -> None:
        self._repo = repo

    async def list_bookmarks(self, user_id: str) -> list[Bookmark]:
        return await self._repo.list(user_id)

    async def add_bookmark(
        self,
        *,
        user_id: str,
        part_id: str,
        question_n: int,
        article_n: int | None,
        label: str | None,
        folder: str | None,
    ) -> Bookmark:
        return await self._repo.add(
            user_id=user_id,
            part_id=part_id,
            question_n=question_n,
            article_n=article_n,
            label=label,
            folder=folder,
        )

    async def move_to_folder(
        self, user_id: str, bookmark_id: str, folder: str | None
    ) -> Bookmark:
        result = await self._repo.update_folder(user_id, bookmark_id, folder)
        if result is None:
            raise BookmarkNotFoundError(bookmark_id)
        return result

    async def delete_bookmark(self, user_id: str, bookmark_id: str) -> None:
        deleted = await self._repo.delete(user_id, bookmark_id)
        if not deleted:
            raise BookmarkNotFoundError(bookmark_id)
