"""Insert demo data. Safe to re-run: rows are keyed by stable ids and only missing ones are added,
so edits and bookings made after the first run are never overwritten.

    uv run python -m app.seed
"""
import uuid

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.db import SessionLocal
from app.models import Amenity, Booking, Listing, ListingPhoto, Review, User
from app.models.user import now
from app.seed_data import AMENITIES, BOOKINGS, DEMO_PASSWORD, LISTINGS, REVIEW_COUNTS, USERS, review_for
from app.services.auth import hash_password
from app.services.pricing import compute_price
from app.vocab import PhotoSource

_NAMESPACE = uuid.UUID("6f1d3c0e-5a0b-4c58-9a4e-2b7f4f1f9c11")
_DAY = 24 * 3600


def stable_id(kind: str, key: str) -> str:
    """The same (kind, key) always gives the same id, which is what makes re-runs safe."""
    return str(uuid.uuid5(_NAMESPACE, f"{kind}:{key}"))


def seed(db: Session) -> None:
    started = now()

    users: dict[str, User] = {}
    password_hash = None  # scrypt is slow on purpose; hash once and reuse for every demo user
    for key, email, name in USERS:
        user = db.get(User, stable_id("user", key))
        if user is None:
            password_hash = password_hash or hash_password(DEMO_PASSWORD)
            user = User(id=stable_id("user", key), email=email, password_hash=password_hash, display_name=name)
            db.add(user)
        users[key] = user

    amenities: dict[str, Amenity] = {}
    for slug, name, icon_key in AMENITIES:
        amenity = db.get(Amenity, stable_id("amenity", slug))
        if amenity is None:
            amenity = Amenity(id=stable_id("amenity", slug), slug=slug, name=name, icon_key=icon_key)
            db.add(amenity)
        amenities[slug] = amenity
    # Reviews and listings point at these by foreign key without an ORM relationship, so save parents first.
    # Committing in small steps keeps each transaction short. A re-run resumes.
    db.commit()

    review_no = 0
    for i, s in enumerate(LISTINGS):
        listing_id = stable_id("listing", s.slug)
        if db.get(Listing, listing_id) is not None:
            continue  # keep whatever the listing looks like now

        db.add(
            Listing(
                id=listing_id,
                host_id=users[s.host].id,
                title=s.title,
                description=s.description,
                city=s.city,
                region=s.region,
                country="India",
                location_label=f"{s.city}, {s.region}",
                latitude=s.lat,
                longitude=s.lng,
                property_type=s.property_type,
                category=s.category,
                max_guests=s.max_guests,
                bedrooms=s.bedrooms,
                beds=s.beds,
                bathrooms=s.bathrooms,
                nightly_price_minor=s.price * 100,
                cleaning_fee_minor=s.cleaning_fee * 100,
                # Staggered so the default newest-first order is the order in seed_data.py.
                created_at=started - i * 3600,
                amenities=[amenities[slug] for slug in s.amenities],
                photos=[
                    ListingPhoto(
                        id=stable_id("photo", f"{s.slug}:{pos}"),
                        source=PhotoSource.UNSPLASH.value,
                        url=f"https://images.unsplash.com/photo-{photo_id}",
                        alt_text=alt,
                        position=pos,
                    )
                    for pos, (photo_id, alt) in enumerate(s.photos)
                ],
            )
        )
        db.commit()

        # Reviewers are the other four users, so nobody reviews their own listing.
        reviewers = [key for key, *_ in USERS if key != s.host]
        for n in range(REVIEW_COUNTS[i]):
            rating, body = review_for(s.host, review_no)
            db.add(
                Review(
                    id=stable_id("review", f"{s.slug}:{reviewers[n]}"),
                    listing_id=listing_id,
                    author_id=users[reviewers[n]].id,
                    rating=rating,
                    body=body,
                    created_at=started - (20 + 9 * review_no) * _DAY,
                )
            )
            review_no += 1
        db.commit()

    # Bookings come last because they point at listings and users. Dates are relative to the
    # first run only: a booking that already exists is never moved by a later run.
    today = clock.today()
    for slug, guest, offset, nights in BOOKINGS:
        booking_id = stable_id("booking", f"{slug}:{guest}:{offset}")
        if db.get(Booking, booking_id) is not None:
            continue
        listing = db.get(Listing, stable_id("listing", slug))
        check_in = today + timedelta(days=offset)
        price = compute_price(listing.nightly_price_minor, listing.cleaning_fee_minor, nights)
        db.add(
            Booking(
                id=booking_id,
                listing_id=listing.id,
                guest_id=users[guest].id,
                check_in=check_in,
                check_out=check_in + timedelta(days=nights),
                guests=2,
                nights=price.nights,
                nightly_price_minor=price.nightly_price_minor,
                subtotal_minor=price.subtotal_minor,
                cleaning_fee_minor=price.cleaning_fee_minor,
                service_fee_minor=price.service_fee_minor,
                total_minor=price.total_minor,
                listing_title_snapshot=listing.title,
                location_snapshot=listing.location_label,
                cover_photo_snapshot=listing.photos[0].url,
                idempotency_key=f"seed-{booking_id}",
                request_fingerprint="seed",
                created_at=started - 7 * _DAY,
            )
        )
        db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
        count = session.scalar(select(func.count()).select_from(Listing))
    print(f"Seed done. {count} listings in the database.")
