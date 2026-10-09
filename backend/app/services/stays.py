"""Rules about dates and guest counts, shared by search, quotes and (later) bookings."""
from datetime import date

from sqlalchemy import and_, exists, select
from sqlalchemy.orm import Session

from app import clock
from app.errors import AppError
from app.models import Booking

MAX_NIGHTS = 365


def validate_dates(check_in: date, check_out: date) -> int:
    """Return the number of nights, or raise 422 naming the bad field."""
    fields = {}
    if check_in < clock.today():
        fields["check_in"] = "Check-in can't be in the past."
    if check_out <= check_in:
        fields["check_out"] = "Check-out must be after check-in."
    elif (check_out - check_in).days > MAX_NIGHTS:
        fields["check_out"] = f"Stays are limited to {MAX_NIGHTS} nights."
    if fields:
        raise AppError(422, "INVALID_DATES", "Check the dates you chose.", fields)
    return (check_out - check_in).days


def validate_guests(guests: int, max_guests: int) -> None:
    if guests < 1:
        raise AppError(422, "INVALID_GUESTS", "Add at least one guest.", {"guests": "At least 1 guest."})
    if guests > max_guests:
        raise AppError(
            422, "INVALID_GUESTS", f"This place fits {max_guests} guests.", {"guests": f"At most {max_guests} guests."}
        )


def overlapping(check_in: date, check_out: date):
    """SQL condition: a confirmed booking that shares at least one night with [check_in, check_out).

    Adjacent stays do not overlap, so a guest can arrive on the previous guest's checkout day.
    """
    return and_(Booking.status == "confirmed", Booking.check_in < check_out, Booking.check_out > check_in)


def is_available(db: Session, listing_id: str, check_in: date, check_out: date) -> bool:
    taken = exists().where(Booking.listing_id == listing_id, overlapping(check_in, check_out))
    return not db.scalar(select(taken))
