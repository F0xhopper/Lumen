from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user_id
from app.history.repository import HistoryRepository
from app.history.schemas import HistoryEntryResponse, RecordVisitRequest
from app.history.service import HistoryService
from app.infrastructure.database import get_pool

router = APIRouter(prefix="/history", tags=["history"])


def _get_service(pool=Depends(get_pool)) -> HistoryService:
    return HistoryService(HistoryRepository(pool))


@router.get("/", response_model=list[HistoryEntryResponse])
async def list_history(
    user_id: str = Depends(get_current_user_id),
    svc: HistoryService = Depends(_get_service),
):
    entries = await svc.list_history(user_id)
    return [HistoryEntryResponse.from_domain(e) for e in entries]


@router.post("/", response_model=HistoryEntryResponse, status_code=status.HTTP_201_CREATED)
async def record_visit(
    req: RecordVisitRequest,
    user_id: str = Depends(get_current_user_id),
    svc: HistoryService = Depends(_get_service),
):
    entry = await svc.record_visit(
        user_id=user_id,
        part_id=req.part_id,
        question_n=req.question_n,
        article_n=req.article_n,
    )
    return HistoryEntryResponse.from_domain(entry)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(
    user_id: str = Depends(get_current_user_id),
    svc: HistoryService = Depends(_get_service),
):
    await svc.clear_history(user_id)
