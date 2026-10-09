"""Rating aggregation and the two reputation badges. The rules live here, in one place; the
frontend only shows what the API says (it never decides who is a Superhost).

Guest favourite is per listing. Superhost is per host, over all of their listings.

Airbnb's real Superhost rules also need a 90% response rate and under 1% cancellations. This app
has no messaging and no cancellations yet, so those two are not checked; the thresholds below are
scaled down from Airbnb's (10 stays, 4.8 stars) to fit a small demo.
"""
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.models import Booking, Listing, Review

GUEST_FAVOURITE_MIN_RATING = 4.8
GUEST_FAVOURITE_MIN_REVIEWS = 3

SUPERHOST_MIN_RATING = 4.8
SUPERHOST_MIN_REVIEWS = 10
SUPERHOST_MIN_COMPLETED_STAYS = 3


@dataclass(frozen=True)
class HostStats:
    rating: float | None  # average over every review of the host's listings
    review_count: int
    completed_stays: int  # confirmed bookings whose checkout day has passed
    superhost: bool


def is_guest_favourite(avg: float | None, review_count: int) -> bool:
    """Compared on the rounded rating the page shows, so "4.8" on screen never misses the badge."""
    return avg is not None and round(avg, 2) >= GUEST_FAVOURITE_MIN_RATING and review_count >= GUEST_FAVOURITE_MIN_REVIEWS


def is_superhost(avg: float | None, review_count: int, completed_stays: int) -> bool:
    return (
        avg is not None
        and round(avg, 2) >= SUPERHOST_MIN_RATING
        and review_count >= SUPERHOST_MIN_REVIEWS
        and completed_stays >= SUPERHOST_MIN_COMPLETED_STAYS
    )


def host_stats(db: Session, host_ids: list[str]) -> dict[str, HostStats]:
    """Stats for several hosts in two queries. Archived listings still count: archiving a
    listing must not erase the reputation its reviews and stays earned."""
    ids = list(set(host_ids))
    if not ids:
        return {}

    reviews = {
        host_id: (avg, n)
        for host_id, avg, n in db.execute(
            select(Listing.host_id, func.avg(Review.rating), func.count())
            .join(Review, Review.listing_id == Listing.id)
            .where(Listing.host_id.in_(ids))
            .group_by(Listing.host_id)
        )
    }
    stays = dict(
        db.execute(
            select(Listing.host_id, func.count())
            .join(Booking, Booking.listing_id == Listing.id)
            .where(Listing.host_id.in_(ids), Booking.status == "confirmed", Booking.check_out <= clock.today())
            .group_by(Listing.host_id)
        ).all()
    )

    out = {}
    for host_id in ids:
        avg, n = reviews.get(host_id, (None, 0))
        done = stays.get(host_id, 0)
        out[host_id] = HostStats(
            rating=None if avg is None else round(avg, 2),
            review_count=n,
            completed_stays=done,
            superhost=is_superhost(avg, n, done),
        )
    return out


def rating_breakdown(db: Session, listing_id: str) -> dict[str, int]:
    """How many 5, 4, 3, 2 and 1 star reviews a listing has (zeros included), for the bars."""
    counts = dict(db.execute(select(Review.rating, func.count()).where(Review.listing_id == listing_id).group_by(Review.rating)).all())
    return {str(stars): counts.get(stars, 0) for stars in (5, 4, 3, 2, 1)}
