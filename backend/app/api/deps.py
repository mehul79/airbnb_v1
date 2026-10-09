from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import User
from app.services import auth as auth_service

SESSION_COOKIE = "session"

DbDep = Annotated[Session, Depends(get_db)]
SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


def current_user(db: DbDep, token: SessionToken = None) -> User:
    user = auth_service.user_for_token(db, token)
    if user is None:
        raise AppError(401, "UNAUTHENTICATED", "Sign in to continue.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
