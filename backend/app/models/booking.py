from datetime import date

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.user import new_id, now


class Booking(Base):
    """A confirmed stay. Prices and listing details are copied in so later listing edits never change it."""

    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("check_out > check_in", name="ck_bookings_dates"),
        CheckConstraint("status IN ('confirmed')", name="ck_bookings_status"),
        CheckConstraint("guests > 0 AND nights > 0", name="ck_bookings_counts"),
        CheckConstraint(
            "nightly_price_minor >= 0 AND subtotal_minor >= 0 AND cleaning_fee_minor >= 0"
            " AND service_fee_minor >= 0 AND total_minor >= 0",
            name="ck_bookings_nonnegative",
        ),
        CheckConstraint("subtotal_minor = nights * nightly_price_minor", name="ck_bookings_subtotal"),
        CheckConstraint(
            "total_minor = subtotal_minor + cleaning_fee_minor + service_fee_minor", name="ck_bookings_total"
        ),
        CheckConstraint("currency = 'INR'", name="ck_bookings_currency"),
        # A retried request with the same key finds its booking instead of making a second one.
        UniqueConstraint("guest_id", "idempotency_key", name="uq_bookings_guest_idempotency"),
        # Overlap checks and availability filters.
        Index("ix_bookings_listing_status_dates", "listing_id", "status", "check_in", "check_out"),
        # My Trips.
        Index("ix_bookings_guest_check_in_id", "guest_id", "check_in", "id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    # No cascade: archiving a listing must never remove a guest's booking.
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id"))
    guest_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    # Calendar dates, stored as 'YYYY-MM-DD' text. A stay occupies [check_in, check_out).
    check_in: Mapped[date]
    check_out: Mapped[date]
    guests: Mapped[int]
    status: Mapped[str] = mapped_column(String(12), default="confirmed", server_default="confirmed")
    nights: Mapped[int]
    nightly_price_minor: Mapped[int]
    subtotal_minor: Mapped[int]
    cleaning_fee_minor: Mapped[int]
    service_fee_minor: Mapped[int]
    total_minor: Mapped[int]
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    listing_title_snapshot: Mapped[str] = mapped_column(String(120))
    location_snapshot: Mapped[str] = mapped_column(String(160))
    cover_photo_snapshot: Mapped[str] = mapped_column(String(500))
    idempotency_key: Mapped[str] = mapped_column(String(80))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[int] = mapped_column(default=now)
