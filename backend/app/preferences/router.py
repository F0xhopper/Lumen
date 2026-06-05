from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user_id
from app.infrastructure.database import get_pool
from app.preferences.domain import FontPrefs
from app.preferences.repository import PreferencesRepository
from app.preferences.schemas import FontPrefsRequest, FontPrefsResponse
from app.preferences.service import PreferencesService

router = APIRouter(prefix="/preferences", tags=["preferences"])


def _get_service(pool=Depends(get_pool)) -> PreferencesService:
    return PreferencesService(PreferencesRepository(pool))


@router.get("/", response_model=FontPrefsResponse)
async def get_preferences(
    user_id: str = Depends(get_current_user_id),
    svc: PreferencesService = Depends(_get_service),
):
    prefs = await svc.get(user_id)
    return FontPrefsResponse.from_domain(prefs)


@router.put("/", response_model=FontPrefsResponse)
async def update_preferences(
    req: FontPrefsRequest,
    user_id: str = Depends(get_current_user_id),
    svc: PreferencesService = Depends(_get_service),
):
    prefs = FontPrefs(
        font_family=req.font_family,
        font_size=req.font_size,
        line_height=req.line_height,
        letter_spacing=req.letter_spacing,
        font_weight=req.font_weight,
    )
    saved = await svc.upsert(user_id, prefs)
    return FontPrefsResponse.from_domain(saved)
