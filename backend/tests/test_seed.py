import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import clock
from app.models import Amenity, Booking, Listing, ListingPhoto, Review, User
from app.models.user import now
from app.seed import seed
from app.seed_data import LISTINGS, BOOKINGS, DEMO_PASSWORD, USERS


def count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_seed_matches_the_target_shape(seeded):
    db = seeded
    assert count(db, Listing) == len(LISTINGS)
    assert count(db, User) == 5
    assert db.scalar(select(func.count(func.distinct(Listing.host_id)))) == 3
    assert db.scalar(select(func.count(func.distinct(Listing.city)))) >= 10
    assert db.scalar(select(func.count(func.distinct(Listing.region)))) == 4
    assert db.scalar(select(func.count(func.distinct(Listing.category)))) >= 8
    assert db.scalar(select(func.count(func.distinct(Listing.property_type)))) >= 6
    for listing in db.scalars(select(Listing)):
        assert 3 <= len(listing.photos) <= 5
        assert [p.position for p in listing.photos] == list(range(len(listing.photos)))
        assert listing.amenities
        assert listing.nightly_price_minor % 100 == 0
        assert all(p.url.startswith("https://images.unsplash.com/photo-") for p in listing.photos)


def test_some_listings_have_no_reviews_and_nobody_reviews_their_own(seeded):
    db = seeded
    reviewed = db.scalar(select(func.count(func.distinct(Review.listing_id))))
    assert 0 < reviewed < len(LISTINGS)
    own = db.scalar(select(func.count()).select_from(Review).join(Listing).where(Review.author_id == Listing.host_id))
    assert own == 0


def test_seed_is_idempotent_and_keeps_edits(seeded):
    db = seeded
    before = {m: count(db, m) for m in (Listing, ListingPhoto, Review, Amenity, User, Booking)}
    listing = db.scalar(select(Listing).order_by(Listing.id))
    listing.title = "Edited by a host"
    listing.nightly_price_minor = 123400
    db.commit()

    seed(db)

    assert {m: count(db, m) for m in before} == before
    db.refresh(listing)
    assert (listing.title, listing.nightly_price_minor) == ("Edited by a host", 123400)


def test_demo_users_can_sign_in(seeded, client):
    key, email, _ = USERS[0]
    r = client.post("/api/v1/auth/signin", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200 and r.json()["email"] == email


@pytest.mark.parametrize(
    "field, value",
    [
        ("category", "castle"),
        ("property_type", "igloo"),
        ("max_guests", 0),
        ("nightly_price_minor", 0),
        ("cleaning_fee_minor", -1),
        ("currency", "USD"),
    ],
)
def test_database_rejects_invalid_listing_values(seeded, field, value):
    db = seeded
    listing = db.scalar(select(Listing))
    setattr(listing, field, value)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_database_enforces_photo_and_review_rules(seeded):
    db = seeded
    listing = db.scalar(select(Listing))
    # Same position twice on one listing.
    db.add(ListingPhoto(listing_id=listing.id, url="https://x.test/a.jpg", alt_text="a", position=0))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    # A Cloudinary id on a non-Cloudinary photo.
    db.add(ListingPhoto(listing_id=listing.id, url="https://x.test/a.jpg", alt_text="a", position=9, cloudinary_public_id="abc"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    # Rating out of range.
    guest = db.scalar(select(User).where(User.id != listing.host_id))
    db.add(Review(listing_id=listing.id, author_id=guest.id, rating=6, body="x", created_at=now()))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_deleting_a_listing_with_reviews_is_blocked(seeded):
    # Application "delete" is archive; the schema must not silently drop review history either.
    db = seeded
    listing_id = db.scalar(select(Review.listing_id).limit(1))
    db.delete(db.get(Listing, listing_id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_seeded_bookings_are_consistent(seeded):
    db = seeded
    bookings = db.scalars(select(Booking)).all()
    assert len(bookings) == len(BOOKINGS) == 22
    assert any(b.check_out < clock.today() for b in bookings) and any(b.check_in > clock.today() for b in bookings)
    for b in bookings:
        listing = db.get(Listing, b.listing_id)
        assert b.guest_id != listing.host_id  # nobody books their own listing
        assert b.listing_title_snapshot == listing.title and b.cover_photo_snapshot == listing.photos[0].url
        assert b.nights == (b.check_out - b.check_in).days


def test_seeded_bookings_never_overlap_but_some_are_back_to_back(seeded):
    bookings = seeded.scalars(select(Booking)).all()
    adjacent = 0
    for a in bookings:
        for b in bookings:
            if a.id != b.id and a.listing_id == b.listing_id:
                assert not (a.check_in < b.check_out and a.check_out > b.check_in)
                adjacent += a.check_out == b.check_in
    assert adjacent >= 1


def test_database_rejects_overlapping_arithmetic_and_duplicate_keys(seeded):
    db = seeded
    b = db.scalar(select(Booking))
    # Totals must add up, dates must be ordered, and a guest cannot reuse an idempotency key.
    for field, value in [("total_minor", b.total_minor + 1), ("subtotal_minor", b.subtotal_minor + 1), ("check_out", b.check_in)]:
        setattr(b, field, value)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    other = db.scalars(select(Booking).where(Booking.id != b.id)).first()
    other.guest_id, other.idempotency_key = b.guest_id, b.idempotency_key
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
