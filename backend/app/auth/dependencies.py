from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.domain import AuthenticatedUser
from app.auth.service import InvalidTokenError, SupabaseAuthService, TokenExpiredError, get_auth_service

_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    svc: SupabaseAuthService = Depends(get_auth_service),
) -> AuthenticatedUser:
    try:
        return svc.verify_token(credentials.credentials)
    except TokenExpiredError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user_id(user: AuthenticatedUser = Depends(get_current_user)) -> str:
    return user.user_id
