from supabase import Client, create_client

from app.auth.domain import AuthenticatedUser
from app.core.config import settings


class InvalidTokenError(Exception):
    pass


class TokenExpiredError(InvalidTokenError):
    pass


class SupabaseAuthService:
    def __init__(self, client: Client) -> None:
        self._client = client

    def verify_token(self, token: str) -> AuthenticatedUser:
        try:
            response = self._client.auth.get_user(token)
        except Exception as exc:
            msg = str(exc).lower()
            if "expired" in msg:
                raise TokenExpiredError("Token has expired") from exc
            raise InvalidTokenError(f"Token is invalid: {exc}") from exc

        if response is None or response.user is None:
            raise InvalidTokenError("Token is invalid: no user returned")

        user = response.user
        return AuthenticatedUser(
            user_id=str(user.id),
            email=user.email or "",
            role=user.role or "authenticated",
        )


def _make_service() -> SupabaseAuthService:
    client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return SupabaseAuthService(client)


_auth_service = _make_service()


def get_auth_service() -> SupabaseAuthService:
    return _auth_service
