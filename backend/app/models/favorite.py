from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.user import now


class Favorite(Base):
    """A listing a user has saved. The pair is the key, so saving twice is a no-op."""

    __tablename__ = "favorites"
    # The wishlist page: one user's favourites, newest first.
    __table_args__ = (Index("ix_favorites_user_created", "user_id", "created_at"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[int] = mapped_column(default=now)
