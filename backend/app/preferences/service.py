from app.preferences.domain import FontPrefs
from app.preferences.repository import PreferencesRepository


class PreferencesService:
    def __init__(self, repo: PreferencesRepository) -> None:
        self._repo = repo

    async def get(self, user_id: str) -> FontPrefs:
        return await self._repo.get(user_id)

    async def upsert(self, user_id: str, prefs: FontPrefs) -> FontPrefs:
        return await self._repo.upsert(user_id, prefs)
