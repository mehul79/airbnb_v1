import hashlib
import secrets

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import User, UserSession
from app.models.user import now

SESSION_SECONDS = 7 * 24 * 3600

# Argon2id with the library's recommended settings. The salt and parameters are stored inside the hash string.
_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored: str) -> bool:
    try:
        return _hasher.verify(password, stored)
    except UnknownHashError:  # not an argon2 hash
        return False


# Checked when the email is unknown, so a miss takes as long as a wrong password.
_DUMMY_HASH = hash_password("not-a-real-password")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    """Store a new session and return the raw token for the cookie."""
    token = secrets.token_urlsafe(32)
    db.add(UserSession(user_id=user.id, token_hash=hash_token(token), expires_at=now() + SESSION_SECONDS))
    db.commit()
    return token


def signup(db: Session, email: str, password: str, display_name: str, age: int) -> User:
    user = User(
        email=email.lower(), password_hash=hash_password(password), display_name=display_name.strip(), age=age
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # The UNIQUE(email) constraint is the real guard; it also covers two signups racing.
        db.rollback()
        raise AppError(409, "EMAIL_TAKEN", "An account with this email already exists.", {"email": "Already registered."})
    return user


def signin(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        # Same message for unknown email and wrong password.
        raise AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")
    return user


def user_for_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    row = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if row is None:
        return None
    if row.expires_at <= now():
        db.delete(row)
        db.commit()
        return None
    return db.get(User, row.user_id)


def end_session(db: Session, token: str | None) -> None:
    if not token:
        return
    row = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if row:
        db.delete(row)
        db.commit()
