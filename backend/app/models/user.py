import time
import uuid

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> int:
    """UTC Unix seconds, used for all audit and session timestamps."""
    return int(time.time())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    # Stored lowercased, so the UNIQUE constraint makes emails case-insensitive.
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(60))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    # Asked at signup (18+, checked in the schema). Null for seeded demo users.
    age: Mapped[int | None]
    created_at: Mapped[int] = mapped_column(default=now)


class UserSession(Base):
    """One signed-in browser. Only the SHA-256 of the cookie token is stored."""

    __tablename__ = "sessions"
    __table_args__ = (Index("ix_sessions_user_id", "user_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[int]
    created_at: Mapped[int] = mapped_column(default=now)
