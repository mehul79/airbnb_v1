"""Rating aggregation, Guest favourite and Superhost. Thresholds are tested at their edges, with
rows built by hand, so a change to a rule fails here and not silently in the UI."""
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.models import Booking, Listing, Review, User
from app.seed import stable_id
from app.seed_data import LISTINGS, TOP_RATED_HOSTS
from app.services import ratings
from tests.conftest import TODAY

API = "/api/v1"


# ---- the pure rules ----


@pytest.mark.parametrize(
    "avg, n, expected",
    [
        (4.8, 3, True),
        (5.0, 3, True),
        (4.79, 3, False),  # 4.79 rounds to 4.79, below 4.8
        (4.8, 2, False),  # not enough reviews
        (4.796, 40, True),  # shown as 4.8, so it counts as 4.8
        (None, 0, False),
    ],
)
def test_guest_favourite_rule(avg, n, expected):
    assert ratings.is_guest_favourite(avg, n) is expected


@pytest.mark.parametrize(
    "avg, reviews, stays, expected",
    [
        (4.8, 10, 3, True),
        (4.79, 10, 3, False),
        (5.0, 9, 3, False),  # one review short
        (5.0, 10, 2, False),  # one stay short
        (None, 0, 0, False),
    ],
)
def test_superhost_rule(avg, reviews, stays, expected):
    assert ratings.is_superhost(avg, reviews, stays) is expected


# ---- aggregation over real rows ----


def make_host(db, key, rating_each, reviews, stays_done, stays_upcoming=0):
    """A host with one listing, `reviews` reviews of `rating_each` stars, and the given bookings."""
    host = User(id=stable_id("user", key), email=f"{key}@example.com", password_hash="x", display_name=key.title())
    db.add(host)
    db.flush()
    listing_id = stable_id("listing", f"{key}-place")
    template = db.get(Listing, stable_id("listing", LISTINGS[0].slug))
    db.add(
        Listing(
            id=listing_id, host_id=host.id, title=f"{key} place", description="d", city="Goa", region="Goa",
            country="India", location_label="Goa", property_type="house", category="trending", max_guests=4,
            bedrooms=1, beds=1, bathrooms=1, nightly_price_minor=100000, cleaning_fee_minor=0,
        )
    )
    db.flush()
    # One review per author per listing is a database rule, so every review needs its own reviewer.
    reviewers = [User(id=stable_id("user", f"{key}-reviewer-{i}"), email=f"{key}.r{i}@example.com", password_hash="x", display_name=f"R{i}") for i in range(reviews)]
    db.add_all(reviewers)
    db.flush()
    guests = [u.id for u in db.scalars(select(User).where(User.id != host.id)).all()]
    for i, reviewer in enumerate(reviewers):
        db.add(Review(id=stable_id("review", f"{key}:{i}"), listing_id=listing_id, author_id=reviewer.id, rating=rating_each, body="ok"))
    for i in range(stays_done + stays_upcoming):
        offset = -(10 + 4 * i) if i < stays_done else 30 + 4 * i
        check_in = TODAY + timedelta(days=offset)
        db.add(
            Booking(
                id=stable_id("booking", f"{key}:{i}"), listing_id=listing_id, guest_id=guests[0],
                check_in=check_in, check_out=check_in + timedelta(days=2), guests=1, nights=2,
                nightly_price_minor=100000, subtotal_minor=200000, cleaning_fee_minor=0, service_fee_minor=20000,
                total_minor=220000, listing_title_snapshot=template.title, location_snapshot="Goa",
                cover_photo_snapshot="x", idempotency_key=f"{key}-{i}", request_fingerprint="f",
            )
        )
    db.commit()
    return host


def test_host_stats_count_reviews_and_only_completed_stays(seeded):
    host = make_host(seeded, "star", rating_each=5, reviews=10, stays_done=3, stays_upcoming=4)
    stats = ratings.host_stats(seeded, [host.id])[host.id]
    assert stats.rating == 5.0 and stats.review_count == 10
    assert stats.completed_stays == 3  # upcoming stays do not count yet
    assert stats.superhost


def test_one_missing_requirement_means_no_superhost(seeded):
    few_stays = make_host(seeded, "newbie", rating_each=5, reviews=12, stays_done=2)
    low_rating = make_host(seeded, "meh", rating_each=4, reviews=12, stays_done=5)
    stats = ratings.host_stats(seeded, [few_stays.id, low_rating.id])
    assert not stats[few_stays.id].superhost and not stats[low_rating.id].superhost
    assert stats[low_rating.id].rating == 4.0


def test_a_host_with_no_reviews_has_no_rating(seeded):
    host = make_host(seeded, "fresh", rating_each=5, reviews=0, stays_done=0)
    stats = ratings.host_stats(seeded, [host.id])[host.id]
    assert stats.rating is None and stats.review_count == 0 and not stats.superhost


def test_archiving_does_not_erase_a_hosts_reputation(seeded):
    host = make_host(seeded, "star", rating_each=5, reviews=10, stays_done=3)
    seeded.get(Listing, stable_id("listing", "star-place")).archived_at = 1
    seeded.commit()
    assert ratings.host_stats(seeded, [host.id])[host.id].superhost


def test_rating_breakdown_includes_zero_buckets(seeded):
    host = make_host(seeded, "mixed", rating_each=5, reviews=3, stays_done=0)
    breakdown = ratings.rating_breakdown(seeded, stable_id("listing", "mixed-place"))
    assert breakdown == {"5": 3, "4": 0, "3": 0, "2": 0, "1": 0}
    assert list(breakdown) == ["5", "4", "3", "2", "1"]


# ---- through the API, on the real seed ----


def all_cards(client):
    return client.get(f"{API}/listings", params={"page_size": 48}).json()["items"]


def test_seed_has_a_superhost_and_hosts_who_are_not(client, seeded):
    cards = all_cards(client)
    top_host_titles = {s.title for s in LISTINGS if s.host in TOP_RATED_HOSTS}
    assert any(c["host_superhost"] for c in cards)
    assert all(c["host_superhost"] for c in cards if c["title"] in top_host_titles)
    assert not all(c["host_superhost"] for c in cards)
    assert not any(c["host_superhost"] for c in cards if c["title"] not in top_host_titles)


def test_guest_favourite_flag_matches_the_rule(client, seeded):
    cards = all_cards(client)
    for c in cards:
        assert c["guest_favourite"] == ratings.is_guest_favourite(c["rating"], c["review_count"]), c["title"]
    assert any(c["guest_favourite"] for c in cards) and not all(c["guest_favourite"] for c in cards)


def test_detail_carries_host_stats_and_breakdown(client, seeded):
    meera = client.get(f"{API}/listings/{stable_id('listing', LISTINGS[0].slug)}").json()
    assert meera["host"]["superhost"] is True
    assert meera["host"]["review_count"] >= ratings.SUPERHOST_MIN_REVIEWS and meera["host"]["rating"] >= 4.8
    assert sum(meera["rating_breakdown"].values()) == meera["review_count"]

    arjun_listing = next(s for s in LISTINGS if s.host == "arjun")
    other = client.get(f"{API}/listings/{stable_id('listing', arjun_listing.slug)}").json()
    assert other["host"]["superhost"] is False and other["host"]["rating"] is not None


def test_wishlist_cards_carry_the_badges_too(client, seeded):
    from app.seed_data import DEMO_PASSWORD, USERS

    emails = {key: email for key, email, _ in USERS}
    client.post(f"{API}/auth/signin", json={"email": emails["rohan"], "password": DEMO_PASSWORD})
    listing_id = stable_id("listing", LISTINGS[0].slug)
    client.put(f"{API}/me/favorites/{listing_id}")
    card = client.get(f"{API}/me/favorites").json()["items"][0]
    assert card["host_superhost"] is True and "guest_favourite" in card
