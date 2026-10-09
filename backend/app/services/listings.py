"""Read-side listing logic: search, detail, reviews, availability and quotes."""
from datetime import date, timedelta
from math import ceil

from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.errors import AppError
from app.models import Amenity, Booking, Listing, ListingPhoto, Review, User, listing_amenities
from app.schemas.listings import (
    AvailabilityOut,
    ListingDetail,
    ListingPage,
    ListingSummary,
    QuoteOut,
    MapPage,
    ReviewOut,
    ReviewPage,
    SearchParams,
)
from app.services import pricing, stays
from app.services import ratings as reputation

MAX_WINDOW_DAYS = 366


def _pages(total: int, page_size: int) -> int:
    return ceil(total / page_size)


def _rating(avg: float | None) -> float | None:
    return None if avg is None else round(avg, 2)


def get_active(db: Session, listing_id: str) -> Listing:
    """404 for unknown and archived listings alike, so archived ones look deleted to the public."""
    listing = db.get(Listing, listing_id)
    if listing is None or listing.archived_at is not None:
        raise AppError(404, "NOT_FOUND", "We could not find that listing.")
    return listing


def summary(
    listing: Listing, avg: float | None, n: int | None, cover: ListingPhoto | None, host_superhost: bool = False
) -> ListingSummary:
    """The card shape shared by search results and the wishlist."""
    return ListingSummary(
        id=listing.id,
        title=listing.title,
        city=listing.city,
        region=listing.region,
        location_label=listing.location_label,
        latitude=listing.latitude,
        longitude=listing.longitude,
        property_type=listing.property_type,
        category=listing.category,
        max_guests=listing.max_guests,
        nightly_price_minor=listing.nightly_price_minor,
        currency=listing.currency,
        photo_url=cover.url if cover else None,
        photo_alt=cover.alt_text if cover else None,
        photo_source=cover.source if cover else None,
        rating=_rating(avg),
        review_count=n or 0,
        guest_favourite=reputation.is_guest_favourite(avg, n or 0),
        host_superhost=host_superhost,
    )


def _conditions(db: Session, p: SearchParams) -> list:
    """The WHERE conditions shared by the results list and the results map."""
    conditions = [Listing.archived_at.is_(None), Listing.max_guests >= p.guests]

    term = (p.location or "").strip()
    if term:
        # Case-insensitive substring over the place fields. autoescape makes "%" and "_" literal.
        conditions.append(
            Listing.city.icontains(term, autoescape=True)
            | Listing.region.icontains(term, autoescape=True)
            | Listing.country.icontains(term, autoescape=True)
        )

    if (p.check_in is None) != (p.check_out is None):
        missing = "check_in" if p.check_in is None else "check_out"
        raise AppError(422, "INVALID_DATES", "Choose both check-in and check-out.", {missing: "Choose both dates."})
    if p.check_in and p.check_out:
        stays.validate_dates(p.check_in, p.check_out)
        # Drop listings that have a confirmed booking sharing any night with the stay.
        conditions.append(~exists().where(Booking.listing_id == Listing.id, stays.overlapping(p.check_in, p.check_out)))

    if p.category:
        conditions.append(Listing.category == p.category.value)
    if p.property_type:
        conditions.append(Listing.property_type == p.property_type.value)

    if p.min_price_minor is not None and p.max_price_minor is not None and p.min_price_minor > p.max_price_minor:
        raise AppError(
            422,
            "INVALID_PRICE_RANGE",
            "Minimum price is above the maximum.",
            {"min_price_minor": "Must not exceed the maximum."},
        )
    if p.min_price_minor is not None:
        conditions.append(Listing.nightly_price_minor >= p.min_price_minor)
    if p.max_price_minor is not None:
        conditions.append(Listing.nightly_price_minor <= p.max_price_minor)

    wanted = set(p.amenity)
    if wanted:
        known = set(db.scalars(select(Amenity.slug)))
        unknown = sorted(wanted - known)
        if unknown:
            raise AppError(422, "UNKNOWN_AMENITY", "Unknown amenity.", {"amenity": f"Unknown: {', '.join(unknown)}"})
        # The listing must have every wanted amenity: count its matching rows and compare.
        has_all = (
            select(listing_amenities.c.listing_id)
            .join(Amenity, Amenity.id == listing_amenities.c.amenity_id)
            .where(Amenity.slug.in_(wanted))
            .group_by(listing_amenities.c.listing_id)
            .having(func.count() == len(wanted))
        )
        conditions.append(Listing.id.in_(has_all))
    return conditions


def _rows(db: Session, conditions: list, limit: int, offset: int = 0):
    """(listing, average rating, review count) for the matches, newest first."""
    ratings = (
        select(Review.listing_id, func.avg(Review.rating).label("avg"), func.count().label("n"))
        .group_by(Review.listing_id)
        .subquery()
    )
    return db.execute(
        select(Listing, ratings.c.avg, ratings.c.n)
        .outerjoin(ratings, ratings.c.listing_id == Listing.id)
        .where(*conditions)
        # id breaks ties so pages never repeat or skip a card.
        .order_by(Listing.created_at.desc(), Listing.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()


def _cards(db: Session, rows) -> list[ListingSummary]:
    # One extra query for all cover photos, and one for the hosts' badges, instead of one per card.
    covers = {
        photo.listing_id: photo
        for photo in db.scalars(
            select(ListingPhoto).where(
                ListingPhoto.listing_id.in_([listing.id for listing, _, _ in rows]), ListingPhoto.position == 0
            )
        )
    }
    hosts = reputation.host_stats(db, [listing.host_id for listing, _, _ in rows])
    return [summary(listing, avg, n, covers.get(listing.id), hosts[listing.host_id].superhost) for listing, avg, n in rows]


def search(db: Session, p: SearchParams) -> ListingPage:
    conditions = _conditions(db, p)
    total = db.scalar(select(func.count()).select_from(Listing).where(*conditions))
    rows = _rows(db, conditions, p.page_size, (p.page - 1) * p.page_size)
    return ListingPage(
        items=_cards(db, rows), page=p.page, page_size=p.page_size, total=total, total_pages=_pages(total, p.page_size)
    )


MAP_LIMIT = 200


def map_pins(db: Session, p: SearchParams) -> MapPage:
    """Every match (not one page) that can be placed on a map, up to MAP_LIMIT. Same filters as search."""
    conditions = _conditions(db, p) + [Listing.latitude.is_not(None), Listing.longitude.is_not(None)]
    total = db.scalar(select(func.count()).select_from(Listing).where(*conditions))
    rows = _rows(db, conditions, MAP_LIMIT)
    return MapPage(items=_cards(db, rows), total=total, truncated=total > MAP_LIMIT)


def detail(db: Session, listing_id: str) -> ListingDetail:
    listing = get_active(db, listing_id)
    host = db.get(User, listing.host_id)
    host_stats = reputation.host_stats(db, [host.id])[host.id]
    avg, n = db.execute(select(func.avg(Review.rating), func.count()).where(Review.listing_id == listing_id)).one()
    return ListingDetail(
        id=listing.id,
        title=listing.title,
        description=listing.description,
        city=listing.city,
        region=listing.region,
        country=listing.country,
        location_label=listing.location_label,
        latitude=listing.latitude,
        longitude=listing.longitude,
        property_type=listing.property_type,
        category=listing.category,
        max_guests=listing.max_guests,
        bedrooms=listing.bedrooms,
        beds=listing.beds,
        bathrooms=listing.bathrooms,
        nightly_price_minor=listing.nightly_price_minor,
        cleaning_fee_minor=listing.cleaning_fee_minor,
        currency=listing.currency,
        photos=listing.photos,
        amenities=listing.amenities,
        host={
            "id": host.id,
            "display_name": host.display_name,
            "avatar_url": host.avatar_url,
            "member_since": host.created_at,
            "rating": host_stats.rating,
            "review_count": host_stats.review_count,
            "superhost": host_stats.superhost,
        },
        rating=_rating(avg),
        review_count=n,
        guest_favourite=reputation.is_guest_favourite(avg, n),
        rating_breakdown=reputation.rating_breakdown(db, listing_id),
    )


def reviews(db: Session, listing_id: str, page: int, page_size: int) -> ReviewPage:
    get_active(db, listing_id)
    total = db.scalar(select(func.count()).select_from(Review).where(Review.listing_id == listing_id))
    rows = db.execute(
        select(Review, User)
        .join(User, User.id == Review.author_id)
        .where(Review.listing_id == listing_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return ReviewPage(
        items=[
            {
                "id": review.id,
                "rating": review.rating,
                "body": review.body,
                "created_at": review.created_at,
                "author": {"display_name": author.display_name, "avatar_url": author.avatar_url},
            }
            for review, author in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=_pages(total, page_size),
    )


def add_review(db: Session, listing_id: str, user_id: str, rating: int, body: str) -> ReviewOut:
    """A guest can review a home once, and only after a stay there has ended."""
    get_active(db, listing_id)
    stayed = db.scalar(
        select(exists().where(Booking.listing_id == listing_id, Booking.guest_id == user_id, Booking.check_out <= clock.today()))
    )
    if not stayed:
        raise AppError(403, "NOT_ELIGIBLE", "You can review a home after your stay there has ended.")
    review = Review(listing_id=listing_id, author_id=user_id, rating=rating, body=body)
    db.add(review)
    try:
        db.commit()
    except IntegrityError:  # uq_reviews_listing_author: the second click of a double submit, or a repeat review
        db.rollback()
        raise AppError(409, "ALREADY_REVIEWED", "You've already reviewed this home.") from None
    author = db.get(User, user_id)
    return ReviewOut(
        id=review.id,
        rating=review.rating,
        body=review.body,
        created_at=review.created_at,
        author={"display_name": author.display_name, "avatar_url": author.avatar_url},
    )


def availability(db: Session, listing_id: str, start: date | None, end: date | None) -> AvailabilityOut:
    get_active(db, listing_id)
    start = start or clock.today()
    end = end or start + timedelta(days=MAX_WINDOW_DAYS - 1)
    if end <= start or (end - start).days > MAX_WINDOW_DAYS:
        raise AppError(
            422,
            "INVALID_WINDOW",
            f"Ask for between 1 and {MAX_WINDOW_DAYS} days.",
            {"to": f"Must be after 'from' and at most {MAX_WINDOW_DAYS} days later."},
        )
    rows = db.execute(
        select(Booking.check_in, Booking.check_out)
        .where(Booking.listing_id == listing_id, stays.overlapping(start, end))
        .order_by(Booking.check_in)
    ).all()
    return AvailabilityOut(occupied=[{"check_in": a, "check_out": b} for a, b in rows])


def build_quote(listing: Listing, check_in: date, check_out: date, guests: int) -> QuoteOut:
    """Validate the stay and price it. Does not look at bookings: a quote is not a hold."""
    nights = stays.validate_dates(check_in, check_out)
    stays.validate_guests(guests, listing.max_guests)
    price = pricing.compute_price(listing.nightly_price_minor, listing.cleaning_fee_minor, nights)
    return QuoteOut(
        listing_id=listing.id,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        currency=listing.currency,
        quote_fingerprint=pricing.fingerprint(listing.id, check_in, check_out, guests, price),
        **price.__dict__,
    )


def quote(db: Session, listing_id: str, check_in: date, check_out: date, guests: int) -> QuoteOut:
    listing = get_active(db, listing_id)
    result = build_quote(listing, check_in, check_out, guests)
    if not stays.is_available(db, listing_id, check_in, check_out):
        raise AppError(409, "DATES_UNAVAILABLE", "Those dates are not available. Choose another stay.")
    return result
