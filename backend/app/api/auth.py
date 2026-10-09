from fastapi import APIRouter, Response

from app.api.deps import SESSION_COOKIE, CurrentUser, DbDep, SessionToken
from app.config import settings
from app.schemas.auth import EmailExistsOut, EmailIn, ProfileUpdateIn, SigninIn, SignupIn, UserOut
from app.services import auth as auth_service

router = APIRouter(tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=auth_service.SESSION_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


# Lets the login dialog pick "sign in" or "sign up" after the email step, like Airbnb does.
# Trade-off: it reveals whether an email is registered (accepted; no throttling by design).
@router.post("/auth/check", response_model=EmailExistsOut)
def check_email(body: EmailIn, db: DbDep):
    return {"exists": auth_service.email_exists(db, body.email)}


@router.post("/auth/signup", response_model=UserOut, status_code=201)
def signup(body: SignupIn, db: DbDep, response: Response):
    user = auth_service.signup(db, body.email, body.password, body.display_name, body.age)
    _set_cookie(response, auth_service.create_session(db, user))
    return user


@router.post("/auth/signin", response_model=UserOut)
def signin(body: SigninIn, db: DbDep, response: Response):
    user = auth_service.signin(db, body.email, body.password)
    _set_cookie(response, auth_service.create_session(db, user))
    return user


@router.post("/auth/signout", status_code=204)
def signout(db: DbDep, response: Response, token: SessionToken = None):
    auth_service.end_session(db, token)
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdateIn, user: CurrentUser, db: DbDep):
    # Only the display name is editable; id, email and age are never taken from the client here.
    user.display_name = body.display_name.strip()
    db.commit()
    return user
