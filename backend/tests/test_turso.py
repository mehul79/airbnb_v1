"""The booking guarantees, checked against the real Turso TESTING database.

Opt in, because it uses the network and takes a couple of minutes:

    TURSO_TESTS=1 uv run pytest tests/test_turso.py

The testing database must already be migrated and seeded:

    uv run python scripts/on_turso.py testing alembic upgrade head
    uv run python scripts/on_turso.py testing python -m app.seed

Tests book far-future nights on one listing and delete everything they created. They never read
.env's production values.
"""
import os
import threading
from datetime import timedelta

import pytest
from dotenv import dotenv_values
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import get_db, make_engine
from app.main import app
from app.models import Booking, Listing, ListingPhoto, User
from app.schemas.bookings import BookingIn
from app.schemas.listings import SearchParams
from app.seed import stable_id
from app.seed_data import DEMO_PASSWORD, LISTINGS, USERS
from app.services import bookings as booking_service
from app.services import listings as listing_service
from tests.conftest import ORIGIN, TODAY

ENV = dotenv_values(".env")
pytestmark = pytest.mark.skipif(
    os.environ.get("TURSO_TESTS") != "1" or "TURSO_DATABASE_URL_TESTING" not in ENV,
    reason="set TURSO_TESTS=1 (and have the testing database in .env) to run the Turso tests",
)

ANJUNA = stable_id("listing", "anjuna-pool-villa")
KEY_PREFIX = "remote-test-"


def day(n: int):
    return TODAY + timedelta(days=n)


@pytest.fixture(scope="module")
def remote():
    saved = settings.turso_auth_token
    settings.turso_auth_token = ENV["TURSO_TESTING_SECRET"]
    engine = make_engine(ENV["TURSO_DATABASE_URL_TESTING"])
    factory = sessionmaker(engine, expire_on_commit=False)

    def clean():
        with factory() as db:
            db.execute(text(f"DELETE FROM bookings WHERE idempotency_key LIKE '{KEY_PREFIX}%'"))
            db.commit()

    with factory() as db:  # fail early and clearly if the database is not ready
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "0004", "run the migrations first"
        assert db.scalar(select(func.count()).select_from(Listing)) == 24, "run the seed first"
    clean()
    yield factory
    clean()
    engine.dispose()
    settings.turso_auth_token = saved


def request(db, guest: str, a: int, b: int, guests: int = 2) -> BookingIn:
    listing = db.get(Listing, ANJUNA)
    quote = listing_service.build_quote(listing, day(a), day(b), guests)
    return BookingIn(
        listing_id=ANJUNA, check_in=day(a), check_out=day(b), guests=guests, quote_fingerprint=quote.quote_fingerprint
    )


def book(factory, guest: str, data: BookingIn, key: str):
    with factory() as db:
        return booking_service.create(db, stable_id("user", guest), data, KEY_PREFIX + key)


def error_code(call):
    with pytest.raises(Exception) as err:
        call()
    return getattr(err.value, "code", repr(err.value))


def test_schema_constraints_and_types_behave_the_same_remotely(remote):
    with remote() as db:
        listing = db.get(Listing, ANJUNA)
        assert listing.bathrooms == 3 and isinstance(listing.bathrooms, float)
        assert listing.nightly_price_minor == 950000 and listing.archived_at is None
        assert db.scalar(select(Booking.check_in).limit(1)).__class__.__name__ == "date"  # Date columns come back as dates
        assert db.get(User, stable_id("user", "meera")).display_name == "Meera Kapoor"
        first_photo = db.scalar(select(ListingPhoto).where(ListingPhoto.listing_id == ANJUNA, ListingPhoto.position == 0))
        assert first_photo.url.startswith("https://images.unsplash.com/") and first_photo.source == "unsplash"

    def violates(**override):
        fields = dict(
            listing_id=ANJUNA, guest_id=stable_id("user", "rohan"), check_in=day(500), check_out=day(502), guests=2,
            nights=2, nightly_price_minor=100, subtotal_minor=200, cleaning_fee_minor=0, service_fee_minor=20,
            total_minor=220, listing_title_snapshot="t", location_snapshot="l", cover_photo_snapshot="c",
            idempotency_key=KEY_PREFIX + "constraint", request_fingerprint="f",
        ) | override
        with remote() as db:
            db.add(Booking(**fields))
            with pytest.raises(IntegrityError):
                db.commit()

    violates(listing_id="no-such-listing")  # foreign key
    violates(total_minor=999)  # CHECK: total = subtotal + fees
    violates(check_out=day(500))  # CHECK: check_out > check_in
    violates(guest_id=stable_id("user", "rohan"), idempotency_key=None)  # NOT NULL


def test_search_returns_what_the_seed_says(remote):
    with remote() as db:
        def titles(**params):
            return {i.title for i in listing_service.search(db, SearchParams(page_size=48, **params)).items}

        assert titles(location="goa") == {s.title for s in LISTINGS if s.region == "Goa"}
        both = titles(amenity=["pool", "breakfast"])
        assert both == {s.title for s in LISTINGS if {"pool", "breakfast"} <= set(s.amenities)}
        page = listing_service.search(db, SearchParams())
        assert (page.total, page.total_pages, len(page.items)) == (24, 2, 12)
        assert page.items[0].photo_url.startswith("https://images.unsplash.com/")
        # The seeded Anjuna booking (days 7-12 from the day it was seeded) hides it for those dates.
        busy = db.scalar(select(Booking).where(Booking.listing_id == ANJUNA, Booking.guest_id == stable_id("user", "rohan"), Booking.check_in > TODAY - timedelta(days=400)).order_by(Booking.check_in.desc()))
        hidden = listing_service.search(db, SearchParams(check_in=busy.check_in, check_out=busy.check_out, page_size=48))
        assert "Whitewashed pool villa near Anjuna beach" not in {i.title for i in hidden.items}


def test_booking_rules_hold_on_turso(remote):
    with remote() as db:
        data = request(db, "rohan", 200, 203)
    made, created = book(remote, "rohan", data, "rules-1")
    assert created and made.total_minor == 3 * 950000 + 150000 + 3 * 95000

    again, created_again = book(remote, "rohan", data, "rules-1")  # a retry
    assert not created_again and again.id == made.id

    with remote() as db:
        other = request(db, "rohan", 210, 212)
    assert error_code(lambda: book(remote, "rohan", other, "rules-1")) == "IDEMPOTENCY_CONFLICT"

    with remote() as db:
        clash = request(db, "ananya", 201, 205)
    assert error_code(lambda: book(remote, "ananya", clash, "rules-2")) == "DATES_UNAVAILABLE"

    with remote() as db:
        after = request(db, "ananya", 203, 205)  # arrives on rohan's checkout day
    assert book(remote, "ananya", after, "rules-3")[1] is True

    stale = data.model_copy(update={"quote_fingerprint": "0" * 64})
    assert error_code(lambda: book(remote, "ananya", stale, "rules-4")) == "PRICE_CHANGED"

    with remote() as db:
        own = request(db, "meera", 300, 302)
    assert error_code(lambda: book(remote, "meera", own, "rules-5")) == "OWN_LISTING"

    with remote() as db:
        assert db.scalar(select(func.count()).select_from(Booking).where(Booking.idempotency_key.like(KEY_PREFIX + "rules-%"))) == 2


def race(factory, jobs):
    """Each job runs in its own thread with its own connection, all released at the same moment."""
    gate = threading.Barrier(len(jobs))
    results = [None] * len(jobs)

    def run(i, guest, data, key):
        with factory() as db:
            db.get(User, stable_id("user", guest))  # open the connection first, so only the booking is timed
            gate.wait()
            try:
                booking, created = booking_service.create(db, stable_id("user", guest), data, KEY_PREFIX + key)
                results[i] = ("ok", booking.id, created)
            except Exception as exc:
                results[i] = ("err", getattr(exc, "code", repr(exc)))

    threads = [threading.Thread(target=run, args=(i, *job)) for i, job in enumerate(jobs)]
    [t.start() for t in threads]
    [t.join(timeout=120) for t in threads]
    return results


def test_two_clients_racing_for_the_same_nights_get_one_booking(remote):
    for round_no in range(2):
        a = 400 + round_no * 20
        with remote() as db:
            first, second = request(db, "rohan", a, a + 3), request(db, "ananya", a + 1, a + 4)
        results = race(remote, [("rohan", first, f"race-{round_no}-r"), ("ananya", second, f"race-{round_no}-a")])
        assert sorted(r[0] for r in results) == ["err", "ok"], results
        assert [r for r in results if r[0] == "err"] == [("err", "DATES_UNAVAILABLE")], results


def test_back_to_back_stays_both_win_and_a_twin_request_makes_one_booking(remote):
    with remote() as db:
        first, second = request(db, "rohan", 500, 503), request(db, "ananya", 503, 506)
        twin = request(db, "rohan", 520, 523)
    results = race(remote, [("rohan", first, "adj-r"), ("ananya", second, "adj-a")])
    assert [r[0] for r in results] == ["ok", "ok"], results

    results = race(remote, [("rohan", twin, "twin"), ("rohan", twin, "twin")])
    assert all(r[0] == "ok" for r in results), results
    assert results[0][1] == results[1][1] and sorted(r[2] for r in results) == [False, True]
    with remote() as db:
        assert db.scalar(select(func.count()).select_from(Booking).where(Booking.idempotency_key == KEY_PREFIX + "twin")) == 1


def test_a_host_edit_between_the_checks_and_the_insert_cannot_slip_through(remote, monkeypatch):
    with remote() as db:
        data = request(db, "rohan", 600, 602)
    real = listing_service.build_quote
    edited = []

    def build_then_edit(listing, *args):
        result = real(listing, *args)
        if not edited:
            edited.append(True)
            with remote() as other:
                other.get(Listing, ANJUNA).nightly_price_minor = 960000
                other.commit()
        return result

    monkeypatch.setattr(listing_service, "build_quote", build_then_edit)
    try:
        assert error_code(lambda: book(remote, "rohan", data, "edit-1")) == "PRICE_CHANGED"
    finally:
        with remote() as other:  # put the seed back exactly as it was
            other.get(Listing, ANJUNA).nightly_price_minor = 950000
            other.commit()
    with remote() as db:
        assert db.scalar(select(func.count()).select_from(Booking).where(Booking.idempotency_key == KEY_PREFIX + "edit-1")) == 0


def test_the_http_api_end_to_end_on_turso(remote):
    from fastapi.testclient import TestClient

    def override():
        with remote() as session:
            yield session

    app.dependency_overrides[get_db] = override
    email = next(e for k, e, _ in USERS if k == "rohan")
    try:
        with TestClient(app, headers=ORIGIN) as client:
            assert client.post("/api/v1/auth/signin", json={"email": email, "password": DEMO_PASSWORD}).status_code == 200
            assert client.get("/api/v1/me").json()["email"] == email
            q = client.post(f"/api/v1/listings/{ANJUNA}/quote", json={"check_in": day(700).isoformat(), "check_out": day(702).isoformat(), "guests": 2})
            assert q.status_code == 200
            body = {"listing_id": ANJUNA, "check_in": day(700).isoformat(), "check_out": day(702).isoformat(), "guests": 2, "quote_fingerprint": q.json()["quote_fingerprint"]}
            headers = {"Idempotency-Key": KEY_PREFIX + "http-1"}
            created = client.post("/api/v1/bookings", json=body, headers=headers)
            retry = client.post("/api/v1/bookings", json=body, headers=headers)
            assert (created.status_code, retry.status_code) == (201, 200) and created.json() == retry.json()
            assert client.get(f"/api/v1/bookings/{created.json()['id']}").json()["total_minor"] == q.json()["total_minor"]
            taken = client.post(f"/api/v1/listings/{ANJUNA}/quote", json={"check_in": day(701).isoformat(), "check_out": day(703).isoformat(), "guests": 2})
            assert taken.status_code == 409
            client.post("/api/v1/auth/signout")
            assert client.get("/api/v1/me").status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
