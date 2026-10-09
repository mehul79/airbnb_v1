"""Saved listings (FAV-01). Every query is scoped to the signed-in user's id."""
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Favorite, Listing, ListingPhoto, Review
from app.schemas.listings import ListingPage
from app.services import listings as listing_service


def ids(db: Session, user_id: str) -> list[str]:
    """Saved listing ids, for filling in the hearts on any page. Archived listings are left out."""
    return list(
        db.scalars(
            select(Favorite.listing_id)
            .join(Listing, Listing.id == Favorite.listing_id)
            .where(Favorite.user_id == user_id, Listing.archived_at.is_(None))
            .order_by(Favorite.created_at.desc(), Favorite.listing_id)
        )
    )


def add(db: Session, user_id: str, listing_id: str) -> None:
    """Idempotent. 404 for unknown or archived listings, so you cannot save what you cannot see."""
    listing_service.get_active(db, listing_id)
    if db.get(Favorite, (user_id, listing_id)) is not None:
        return
    db.add(Favorite(user_id=user_id, listing_id=listing_id))
    try:
        db.commit()
    except IntegrityError:
        # Two requests saved it at once; the primary key kept it to one row, which is the goal.
        db.rollback()


def remove(db: Session, user_id: str, listing_id: str) -> None:
    """Idempotent: removing something that is not saved is fine."""
    favorite = db.get(Favorite, (user_id, listing_id))
    if favorite is not None:
        db.delete(favorite)
        db.commit()


def page(db: Session, user_id: str, number: int, page_size: int) -> ListingPage:
    where = (Favorite.user_id == user_id, Listing.archived_at.is_(None))
    total = db.scalar(
        select(func.count()).select_from(Favorite).join(Listing, Listing.id == Favorite.listing_id).where(*where)
    )

    ratings = (
        select(Review.listing_id, func.avg(Review.rating).label("avg"), func.count().label("n"))
        .group_by(Review.listing_id)
        .subquery()
    )
    rows = db.execute(
        select(Listing, ratings.c.avg, ratings.c.n)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .outerjoin(ratings, ratings.c.listing_id == Listing.id)
        .where(*where)
        .order_by(Favorite.created_at.desc(), Listing.id.desc())
        .limit(page_size)
        .offset((number - 1) * page_size)
    ).all()
    covers = {
        p.listing_id: p
        for p in db.scalars(
            select(ListingPhoto).where(
                ListingPhoto.listing_id.in_([listing.id for listing, _, _ in rows]), ListingPhoto.position == 0
            )
        )
    }
    return ListingPage(
        items=[listing_service.summary(listing, avg, n, covers.get(listing.id)) for listing, avg, n in rows],
        page=number,
        page_size=page_size,
        total=total,
        total_pages=listing_service._pages(total, page_size),
    )
