from fastapi import APIRouter, Depends, HTTPException, status

from app.bookmarks.repository import BookmarkRepository
from app.bookmarks.schemas import BookmarkCreateRequest, BookmarkMoveRequest, BookmarkResponse
from app.bookmarks.service import BookmarkNotFoundError, BookmarkService
from app.auth.dependencies import get_current_user_id
from app.infrastructure.database import get_pool

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


def _get_service(pool=Depends(get_pool)) -> BookmarkService:
    return BookmarkService(BookmarkRepository(pool))


@router.get("/", response_model=list[BookmarkResponse])
async def list_bookmarks(
    user_id: str = Depends(get_current_user_id),
    svc: BookmarkService = Depends(_get_service),
):
    bookmarks = await svc.list_bookmarks(user_id)
    return [BookmarkResponse.from_domain(b) for b in bookmarks]


@router.post("/", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def add_bookmark(
    req: BookmarkCreateRequest,
    user_id: str = Depends(get_current_user_id),
    svc: BookmarkService = Depends(_get_service),
):
    bookmark = await svc.add_bookmark(
        user_id=user_id,
        part_id=req.part_id,
        question_n=req.question_n,
        article_n=req.article_n,
        label=req.label,
        folder=req.folder,
    )
    return BookmarkResponse.from_domain(bookmark)


@router.patch("/{bookmark_id}", response_model=BookmarkResponse)
async def move_bookmark(
    bookmark_id: str,
    req: BookmarkMoveRequest,
    user_id: str = Depends(get_current_user_id),
    svc: BookmarkService = Depends(_get_service),
):
    try:
        bookmark = await svc.move_to_folder(user_id, bookmark_id, req.folder)
        return BookmarkResponse.from_domain(bookmark)
    except BookmarkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(
    bookmark_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: BookmarkService = Depends(_get_service),
):
    try:
        await svc.delete_bookmark(user_id, bookmark_id)
    except BookmarkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
