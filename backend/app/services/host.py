"""Host-side listing management (HOST-01..03). Every query filters on host_id = the signed-in user.

There is no host role: whoever creates a listing owns it, and ownership is the only check.
"""
from math import ceil
from urllib.parse import urlparse

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.errors import AppError
from app.models import Amenity, Booking, Listing, ListingPhoto, User
from app.models.user import now
from app.services import uploads
from app.schemas.host import (
    HostBookingOut,
    HostBookingPage,
    HostListingIn,
    HostListingList,
    HostListingOut,
    HostListingPatch,
    HostListingSummary,
    HostPhotoOut,
)
from app.vocab import PhotoSource

_PHOTO_HOSTS = {"images.unsplash.com": PhotoSource.UNSPLASH, "res.cloudinary.com": PhotoSource.CLOUDINARY}


def _photo_source(url: str) -> str:
    """Which loader the frontend should use. Anything else is a plain link."""
    return _PHOTO_HOSTS.get(urlparse(url).hostname or "", PhotoSource.URL).value


def get_owned(db: Session, host_id: str, listing_id: str) -> Listing:
    """404 for a missing listing and for someone else's, so ids cannot be probed."""
    listing = db.scalar(select(Listing).where(Listing.id == listing_id, Listing.host_id == host_id))
    if listing is None:
        raise AppError(404, "NOT_FOUND", "We could not find that listing.")
    return listing


def to_out(listing: Listing) -> HostListingOut:
    return HostListingOut(
        **{
            name: getattr(listing, name)
            for name in (
                "id", "title", "description", "city", "region", "country", "location_label", "latitude", "longitude",
                "property_type", "category", "max_guests", "bedrooms", "beds", "bathrooms", "nightly_price_minor",
                "cleaning_fee_minor", "currency", "archived_at", "created_at",
            )
        },
        photos=[HostPhotoOut.model_validate(p) for p in listing.photos],
        amenities=sorted(a.slug for a in listing.amenities),  # one stable order, wherever it was loaded from
    )


def _amenities(db: Session, slugs: list[str]) -> list[Amenity]:
    found = {a.slug: a for a in db.scalars(select(Amenity).where(Amenity.slug.in_(slugs)))} if slugs else {}
    unknown = [s for s in slugs if s not in found]
    if unknown:
        raise AppError(422, "UNKNOWN_AMENITY", "Unknown amenity.", {"amenities": f"Unknown: {', '.join(unknown)}"})
    return [found[s] for s in slugs]


def _photos(data: HostListingIn) -> list[ListingPhoto]:
    # Positions come from the order sent: the first photo is the cover.
    return [
        ListingPhoto(
            url=p.url,
            alt_text=p.alt_text.strip() or data.title,
            source=_photo_source(p.url),
            cloudinary_public_id=uploads.cloudinary_public_id(p.url),
            position=i,
        )
        for i, p in enumerate(data.photos)
    ]


def create(db: Session, host_id: str, data: HostListingIn) -> Listing:
    listing = Listing(
        host_id=host_id,  # from the session, never from the request
        **data.model_dump(exclude={"photos", "amenities"}),
    )
    listing.photos = _photos(data)
    listing.amenities = _amenities(db, data.amenities)
    db.add(listing)
    db.commit()
    return listing


def update(db: Session, host_id: str, listing_id: str, patch: HostListingPatch) -> Listing:
    listing = get_owned(db, host_id, listing_id)
    if listing.archived_at is not None:
        raise AppError(409, "LISTING_ARCHIVED", "This listing is archived and can no longer be edited.")

    # Merge the changes into the stored record, then validate the whole thing, so a PATCH
    # can never leave a listing that POST would have refused.
    current = to_out(listing).model_dump()
    merged = {k: current[k] for k in HostListingIn.model_fields}
    merged["photos"] = [{"url": p["url"], "alt_text": p["alt_text"]} for p in current["photos"]]
    merged.update(patch.model_dump(exclude_unset=True, mode="python"))
    if "photos" in patch.model_fields_set and patch.photos is not None:
        merged["photos"] = [p.model_dump() for p in patch.photos]
    try:
        data = HostListingIn.model_validate(merged)
    except ValidationError as exc:
        fields = {}
        for err in exc.errors():
            fields.setdefault(str(err["loc"][-1]) if err["loc"] else "body", err["msg"])
        raise AppError(422, "VALIDATION_ERROR", "Some fields are invalid.", fields)

    for name, value in data.model_dump(exclude={"photos", "amenities"}).items():
        setattr(listing, name, value)
    if "photos" in patch.model_fields_set:
        # Delete the old rows before inserting the new ones, or UNIQUE(listing_id, position) trips.
        listing.photos.clear()
        db.flush()
        listing.photos.extend(_photos(data))
    if "amenities" in patch.model_fields_set:
        listing.amenities = _amenities(db, data.amenities)
    db.commit()  # one transaction: all of it lands or none of it does
    return listing


def archive(db: Session, host_id: str, listing_id: str) -> None:
    """"Delete" means archive: hidden from search and new bookings, existing trips stay readable. Idempotent."""
    listing = get_owned(db, host_id, listing_id)
    if listing.archived_at is None:
        listing.archived_at = now()
        db.commit()


def dashboard(db: Session, host_id: str, include_archived: bool) -> HostListingList:
    today = clock.today()
    upcoming = (
        select(Booking.listing_id, func.count().label("n"))
        .where(Booking.check_out > today)
        .group_by(Booking.listing_id)
        .subquery()
    )
    conditions = [Listing.host_id == host_id]
    if not include_archived:
        conditions.append(Listing.archived_at.is_(None))
    rows = db.execute(
        select(Listing, upcoming.c.n)
        .outerjoin(upcoming, upcoming.c.listing_id == Listing.id)
        .where(*conditions)
        .order_by(Listing.created_at.desc(), Listing.id.desc())
    ).all()
    return HostListingList(
        items=[
            HostListingSummary(
                id=listing.id,
                title=listing.title,
                location_label=listing.location_label,
                nightly_price_minor=listing.nightly_price_minor,
                photo_url=listing.photos[0].url if listing.photos else None,
                archived_at=listing.archived_at,
                upcoming_bookings=n or 0,
            )
            for listing, n in rows
        ]
    )


def reservations(
    db: Session, host_id: str, listing_id: str | None, phase: str, page: int, page_size: int
) -> HostBookingPage:
    """Bookings on the caller's listings only. A listing_id that is not theirs simply matches nothing."""
    today = clock.today()
    conditions = [Listing.host_id == host_id]
    if listing_id:
        conditions.append(Listing.id == listing_id)
    if phase == "upcoming":
        conditions.append(Booking.check_out > today)
        order = (Booking.check_in.asc(), Booking.id.asc())
    else:
        if phase == "past":
            conditions.append(Booking.check_out <= today)
        order = (Booking.check_in.desc(), Booking.id.desc())

    base = select(Booking, User.display_name).join(Listing, Listing.id == Booking.listing_id).join(User, User.id == Booking.guest_id)
    total = db.scalar(
        select(func.count()).select_from(Booking).join(Listing, Listing.id == Booking.listing_id).where(*conditions)
    )
    rows = db.execute(base.where(*conditions).order_by(*order).limit(page_size).offset((page - 1) * page_size)).all()
    return HostBookingPage(
        items=[
            HostBookingOut(
                id=b.id,
                reference=b.id[:8].upper(),
                listing_id=b.listing_id,
                listing_title=b.listing_title_snapshot,
                guest_name=guest_name,
                guests=b.guests,
                check_in=b.check_in,
                check_out=b.check_out,
                nights=b.nights,
                total_minor=b.total_minor,
                currency=b.currency,
                phase="past" if b.check_out <= today else "upcoming",
                created_at=b.created_at,
            )
            for b, guest_name in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=ceil(total / page_size),
    )
