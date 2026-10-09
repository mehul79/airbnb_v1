"""Booking and trips. Booking is the one place two requests can fight over the same nights."""
import hashlib
from math import ceil

from sqlalchemy import exists, func, insert, literal, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.errors import AppError
from app.models import Booking, Listing, ListingPhoto, Review
from app.models.user import new_id, now
from app.schemas.bookings import BookingIn, BookingOut, BookingPage
from app.services import listings as listing_service
from app.services import stays


def to_out(b: Booking, reviewed: bool = False) -> BookingOut:
    return BookingOut(
        id=b.id,
        reference=b.id[:8].upper(),
        listing_id=b.listing_id,
        status=b.status,
        phase="past" if b.check_out <= clock.today() else "upcoming",
        check_in=b.check_in,
        check_out=b.check_out,
        guests=b.guests,
        nights=b.nights,
        nightly_price_minor=b.nightly_price_minor,
        subtotal_minor=b.subtotal_minor,
        cleaning_fee_minor=b.cleaning_fee_minor,
        service_fee_minor=b.service_fee_minor,
        total_minor=b.total_minor,
        currency=b.currency,
        listing_title=b.listing_title_snapshot,
        location=b.location_snapshot,
        cover_photo_url=b.cover_photo_snapshot,
        created_at=b.created_at,
        reviewed=reviewed,
    )


def _request_fingerprint(data: BookingIn) -> str:
    """Identifies the request body. Same key and same fingerprint is a retry; same key and a different one is a mistake."""
    parts = [data.listing_id, data.check_in.isoformat(), data.check_out.isoformat(), str(data.guests), data.quote_fingerprint]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def _find(db: Session, guest_id: str, key: str) -> Booking | None:
    return db.scalar(select(Booking).where(Booking.guest_id == guest_id, Booking.idempotency_key == key))


def _replay(existing: Booking, fingerprint: str) -> tuple[Booking, bool]:
    if existing.request_fingerprint != fingerprint:
        raise AppError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used for a different booking.")
    return existing, False


def _price_changed(quote) -> AppError:
    return AppError(
        409,
        "PRICE_CHANGED",
        "The price changed since you last looked. Review the new total.",
        extra={"quote": quote.model_dump(mode="json")},
    )


# Order matters: it must match the select list in create().
_COLUMNS = [
    Booking.id, Booking.listing_id, Booking.guest_id, Booking.check_in, Booking.check_out, Booking.guests,
    Booking.status, Booking.nights, Booking.nightly_price_minor, Booking.subtotal_minor, Booking.cleaning_fee_minor,
    Booking.service_fee_minor, Booking.total_minor, Booking.currency, Booking.listing_title_snapshot,
    Booking.location_snapshot, Booking.cover_photo_snapshot, Booking.idempotency_key, Booking.request_fingerprint,
    Booking.created_at,
]


def create(db: Session, guest_id: str, data: BookingIn, idempotency_key: str) -> tuple[Booking, bool]:
    """Return (booking, created). created is False when this is a retry of an earlier request.

    Everything before the insert only reads, to give clear errors. The decision itself is the insert:
    one INSERT ... SELECT that writes the booking only if, at that instant, the listing is still active,
    still at the quoted price, and no confirmed booking shares a night. The database runs one statement
    atomically, so two requests for the same nights cannot both succeed, however they interleave and
    whichever database (local SQLite or Turso) is underneath. No lock or open transaction is needed,
    which matters on Turso where every round trip is slow.
    """
    fingerprint = _request_fingerprint(data)

    existing = _find(db, guest_id, idempotency_key)
    if existing is not None:
        return _replay(existing, fingerprint)

    listing = listing_service.get_active(db, data.listing_id)
    if listing.host_id == guest_id:
        raise AppError(403, "OWN_LISTING", "You cannot book your own listing.")

    quote = listing_service.build_quote(listing, data.check_in, data.check_out, data.guests)
    if quote.quote_fingerprint != data.quote_fingerprint:
        raise _price_changed(quote)

    booking_id = new_id()
    cover_photo = (
        select(ListingPhoto.url).where(ListingPhoto.listing_id == Listing.id, ListingPhoto.position == 0).scalar_subquery()
    )
    claim = select(
        literal(booking_id), Listing.id, literal(guest_id), literal(data.check_in), literal(data.check_out),
        literal(data.guests), literal("confirmed"), literal(quote.nights), literal(quote.nightly_price_minor),
        literal(quote.subtotal_minor), literal(quote.cleaning_fee_minor), literal(quote.service_fee_minor),
        literal(quote.total_minor), literal(quote.currency), Listing.title, Listing.location_label, cover_photo,
        literal(idempotency_key), literal(fingerprint), literal(now()),
    ).where(
        Listing.id == listing.id,
        Listing.archived_at.is_(None),
        # The price the guest agreed to must still be the price.
        Listing.nightly_price_minor == quote.nightly_price_minor,
        Listing.cleaning_fee_minor == quote.cleaning_fee_minor,
        ~exists().where(Booking.listing_id == Listing.id, stays.overlapping(data.check_in, data.check_out)),
    )

    try:
        inserted = db.execute(insert(Booking).from_select(_COLUMNS, claim, include_defaults=False)).rowcount
        db.commit()
    except IntegrityError:
        # UNIQUE(guest_id, idempotency_key): an identical request got in first.
        db.rollback()
        existing = _find(db, guest_id, idempotency_key)
        if existing is None:
            raise
        return _replay(existing, fingerprint)

    if inserted == 1:
        return db.get(Booking, booking_id), True

    # Nothing was written. Work out why, most specific reason first.
    existing = _find(db, guest_id, idempotency_key)
    if existing is not None:
        return _replay(existing, fingerprint)  # a twin request created it a moment ago
    db.refresh(listing)
    if listing.archived_at is not None:
        raise AppError(404, "NOT_FOUND", "We could not find that listing.")
    fresh = listing_service.build_quote(listing, data.check_in, data.check_out, data.guests)
    if fresh.quote_fingerprint != quote.quote_fingerprint:
        raise _price_changed(fresh)  # the host edited the price after we read it
    raise AppError(409, "DATES_UNAVAILABLE", "These dates were just booked. Choose another stay.")


def get_for_guest(db: Session, guest_id: str, booking_id: str) -> Booking:
    """404 whether the booking is missing or belongs to someone else, so ids cannot be probed."""
    booking = db.scalar(select(Booking).where(Booking.id == booking_id, Booking.guest_id == guest_id))
    if booking is None:
        raise AppError(404, "NOT_FOUND", "We could not find that booking.")
    return booking


def trips(db: Session, guest_id: str, phase: str, page: int, page_size: int) -> BookingPage:
    today = clock.today()
    conditions = [Booking.guest_id == guest_id]
    # A stay is upcoming until its checkout day arrives.
    if phase == "upcoming":
        conditions.append(Booking.check_out > today)
        order = (Booking.check_in.asc(), Booking.id.asc())  # soonest first
    else:
        if phase == "past":
            conditions.append(Booking.check_out <= today)
        order = (Booking.check_in.desc(), Booking.id.desc())  # most recent first

    total = db.scalar(select(func.count()).select_from(Booking).where(*conditions))
    rows = db.scalars(
        select(Booking).where(*conditions).order_by(*order).limit(page_size).offset((page - 1) * page_size)
    ).all()
    reviewed = set(
        db.scalars(select(Review.listing_id).where(Review.author_id == guest_id, Review.listing_id.in_([b.listing_id for b in rows])))
    )
    return BookingPage(
        items=[to_out(b, b.listing_id in reviewed) for b in rows],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=ceil(total / page_size),
    )
