"""Booking, retries, races and trips. Dates are relative to the pinned TODAY.

Seeded: the Anjuna villa (host Meera) is booked days 7-12 and 25-28. Demo guests are Rohan and Ananya.
"""
import threading
from datetime import timedelta

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import sessionmaker

from app import clock
from app.db import get_db, make_engine
from app.main import app
from app.models import Booking, Listing
from app.schemas.bookings import BookingIn
from app.seed import stable_id
from app.seed_data import BOOKINGS, DEMO_PASSWORD, USERS
from app.services import bookings as booking_service
from tests.conftest import TODAY

API = "/api/v1"
ANJUNA = stable_id("listing", "anjuna-pool-villa")
EMAILS = {key: email for key, email, _ in USERS}


def day(n: int) -> str:
    return (TODAY + timedelta(days=n)).isoformat()


def sign_in(client, who: str):
    r = client.post(f"{API}/auth/signin", json={"email": EMAILS[who], "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text


def quote(client, a: int, b: int, guests: int = 2, listing_id: str = ANJUNA) -> dict:
    r = client.post(f"{API}/listings/{listing_id}/quote", json={"check_in": day(a), "check_out": day(b), "guests": guests})
    assert r.status_code == 200, r.text
    return r.json()


def book(client, a: int, b: int, key: str = "key-0001-aaaa", guests: int = 2, listing_id: str = ANJUNA, fingerprint=None):
    body = {
        "listing_id": listing_id,
        "check_in": day(a),
        "check_out": day(b),
        "guests": guests,
        "quote_fingerprint": fingerprint or quote(client, a, b, guests, listing_id)["quote_fingerprint"],
    }
    return client.post(f"{API}/bookings", json=body, headers={"Idempotency-Key": key})


def booking_count(db) -> int:
    return db.scalar(select(func.count()).select_from(Booking))


# ---- creating a booking ----


def test_booking_requires_sign_in_and_an_idempotency_key(client, seeded):
    body = {"listing_id": ANJUNA, "check_in": day(40), "check_out": day(42), "guests": 2, "quote_fingerprint": "x" * 64}
    assert client.post(f"{API}/bookings", json=body, headers={"Idempotency-Key": "key-0001-aaaa"}).status_code == 401
    sign_in(client, "rohan")
    assert client.post(f"{API}/bookings", json=body).status_code == 422  # no key
    assert client.post(f"{API}/bookings", json=body, headers={"Idempotency-Key": "short"}).status_code == 422


def test_booking_is_saved_priced_by_the_server_and_blocks_the_nights(client, seeded):
    sign_in(client, "rohan")
    before = booking_count(seeded)
    q = quote(client, 40, 42)
    r = book(client, 40, 42)
    assert r.status_code == 201, r.text
    b = r.json()
    assert (b["nights"], b["subtotal_minor"], b["cleaning_fee_minor"], b["service_fee_minor"], b["total_minor"]) == (
        2,
        1900000,
        150000,
        190000,
        2240000,
    )
    assert b["total_minor"] == q["total_minor"] and b["status"] == "confirmed" and b["phase"] == "upcoming"
    assert b["listing_title"] == "Whitewashed pool villa near Anjuna beach"
    assert b["cover_photo_url"].startswith("https://images.unsplash.com/") and len(b["reference"]) == 8
    assert booking_count(seeded) == before + 1

    # The nights are gone for everyone, in availability, quotes and search.
    taken = client.get(f"{API}/listings/{ANJUNA}/availability", params={"from": day(38), "to": day(45)}).json()
    assert taken["occupied"] == [{"check_in": day(40), "check_out": day(42)}]
    assert client.post(f"{API}/listings/{ANJUNA}/quote", json={"check_in": day(41), "check_out": day(43), "guests": 2}).status_code == 409
    found = client.get(f"{API}/listings", params={"check_in": day(40), "check_out": day(42), "page_size": 48}).json()
    assert "Whitewashed pool villa near Anjuna beach" not in {i["title"] for i in found["items"]}


def test_a_retry_returns_the_same_booking_and_creates_nothing(client, seeded):
    sign_in(client, "rohan")
    fp = quote(client, 40, 42)["quote_fingerprint"]  # a retrying client reuses the quote it already has
    first = book(client, 40, 42, key="retry-key-0001", fingerprint=fp)
    count = booking_count(seeded)
    again = book(client, 40, 42, key="retry-key-0001", fingerprint=fp)
    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json() == first.json() and booking_count(seeded) == count


def test_a_retry_still_works_after_the_dates_pass(client, seeded, monkeypatch):
    sign_in(client, "rohan")
    first = book(client, 40, 42, key="retry-key-0002")
    monkeypatch.setattr(clock, "today", lambda: TODAY + timedelta(days=60))
    # A retry can arrive late; it must be answered from the stored booking, not re-validated against today.
    again = client.post(
        f"{API}/bookings",
        json={
            "listing_id": ANJUNA,
            "check_in": day(40),
            "check_out": day(42),
            "guests": 2,
            "quote_fingerprint": quote_fingerprint_for(seeded, 40, 42),
        },
        headers={"Idempotency-Key": "retry-key-0002"},
    )
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]


def quote_fingerprint_for(db, a: int, b: int) -> str:
    from app.services import pricing

    listing = db.get(Listing, ANJUNA)
    price = pricing.compute_price(listing.nightly_price_minor, listing.cleaning_fee_minor, b - a)
    return pricing.fingerprint(ANJUNA, TODAY + timedelta(days=a), TODAY + timedelta(days=b), 2, price)


def test_the_same_key_with_a_different_request_is_a_conflict(client, seeded):
    sign_in(client, "rohan")
    three_guests = quote(client, 40, 42, guests=3)["quote_fingerprint"]
    other_dates = quote(client, 50, 52)["quote_fingerprint"]
    book(client, 40, 42, key="reused-key-001")
    count = booking_count(seeded)
    for different in (
        book(client, 40, 42, key="reused-key-001", guests=3, fingerprint=three_guests),
        book(client, 50, 52, key="reused-key-001", fingerprint=other_dates),
    ):
        assert different.status_code == 409 and different.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert booking_count(seeded) == count


def test_keys_belong_to_one_guest(client, seeded):
    sign_in(client, "rohan")
    a = book(client, 40, 42, key="shared-key-001")
    sign_in(client, "ananya")
    b = book(client, 45, 47, key="shared-key-001")  # another guest may use the same string
    assert (a.status_code, b.status_code) == (201, 201) and a.json()["id"] != b.json()["id"]


def test_taken_nights_are_refused_but_back_to_back_stays_are_fine(client, seeded):
    sign_in(client, "rohan")
    assert book(client, 40, 44, key="rohan-key-0001").status_code == 201
    sign_in(client, "ananya")
    clash = book(client, 42, 46, key="ananya-key-001", fingerprint=quote_fingerprint_for(seeded, 42, 46))
    assert clash.status_code == 409 and clash.json()["error"]["code"] == "DATES_UNAVAILABLE"
    assert book(client, 44, 46, key="ananya-key-002").status_code == 201  # arrives on checkout day
    assert book(client, 38, 40, key="ananya-key-003").status_code == 201  # leaves on arrival day


def test_a_changed_price_is_refused_with_the_new_quote(client, seeded):
    sign_in(client, "rohan")
    old = quote(client, 40, 42)["quote_fingerprint"]
    seeded.get(Listing, ANJUNA).nightly_price_minor = 1000000
    seeded.commit()
    count = booking_count(seeded)

    r = book(client, 40, 42, key="stale-key-0001", fingerprint=old)
    err = r.json()["error"]
    assert r.status_code == 409 and err["code"] == "PRICE_CHANGED"
    assert err["quote"]["nightly_price_minor"] == 1000000 and err["quote"]["total_minor"] == 2000000 + 150000 + 200000
    assert booking_count(seeded) == count

    # Accepting the new quote works, and the guest pays the new price.
    ok = book(client, 40, 42, key="stale-key-0002", fingerprint=err["quote"]["quote_fingerprint"])
    assert ok.status_code == 201 and ok.json()["nightly_price_minor"] == 1000000

    garbage = book(client, 50, 52, key="stale-key-0003", fingerprint="0" * 64)
    assert garbage.status_code == 409 and garbage.json()["error"]["code"] == "PRICE_CHANGED"


def test_invalid_requests_save_nothing(client, seeded):
    sign_in(client, "rohan")
    count = booking_count(seeded)
    fp = quote(client, 40, 42)["quote_fingerprint"]
    past = book(client, -2, 2, key="bad-key-00001", fingerprint=fp)
    assert past.status_code == 422 and "check_in" in past.json()["error"]["fields"]
    assert book(client, 40, 40, key="bad-key-00002", fingerprint=fp).status_code == 422  # zero nights
    over = client.post(
        f"{API}/bookings",
        json={"listing_id": ANJUNA, "check_in": day(40), "check_out": day(42), "guests": 7, "quote_fingerprint": fp},
        headers={"Idempotency-Key": "bad-key-00003"},
    )
    assert over.status_code == 422 and "guests" in over.json()["error"]["fields"]
    assert book(client, 40, 42, key="bad-key-00004", listing_id="nope", fingerprint=fp).status_code == 404
    assert booking_count(seeded) == count


def test_you_cannot_book_your_own_or_an_archived_listing(client, seeded):
    sign_in(client, "meera")  # Meera hosts the Anjuna villa
    own = book(client, 40, 42, key="own-key-00001")
    assert own.status_code == 403 and own.json()["error"]["code"] == "OWN_LISTING"

    sign_in(client, "rohan")
    fp = quote(client, 40, 42)["quote_fingerprint"]
    seeded.get(Listing, ANJUNA).archived_at = 1
    seeded.commit()
    assert book(client, 40, 42, key="arch-key-00001", fingerprint=fp).status_code == 404


def test_the_client_cannot_choose_who_pays_or_how_much(client, seeded):
    sign_in(client, "rohan")
    fp = quote(client, 40, 42)["quote_fingerprint"]
    body = {
        "listing_id": ANJUNA,
        "check_in": day(40),
        "check_out": day(42),
        "guests": 2,
        "quote_fingerprint": fp,
        "guest_id": "someone-else",
        "total_minor": 1,
        "status": "cancelled",
    }
    r = client.post(f"{API}/bookings", json=body, headers={"Idempotency-Key": "inject-key-001"})
    assert r.status_code == 201 and r.json()["total_minor"] == 2240000 and r.json()["status"] == "confirmed"
    stored = seeded.get(Booking, r.json()["id"])
    assert stored.guest_id == stable_id("user", "rohan")


# ---- reading bookings ----


def test_a_booking_survives_listing_edits_and_archiving(client, seeded):
    sign_in(client, "rohan")
    made = book(client, 40, 42).json()
    listing = seeded.get(Listing, ANJUNA)
    listing.title, listing.nightly_price_minor, listing.archived_at = "Renamed", 5, 1
    seeded.commit()
    seen = client.get(f"{API}/bookings/{made['id']}")
    assert seen.status_code == 200 and seen.json() == made
    assert seen.json()["listing_title"] == "Whitewashed pool villa near Anjuna beach" and seen.json()["total_minor"] == 2240000


def test_bookings_are_private(client, seeded):
    sign_in(client, "rohan")
    made = book(client, 40, 42).json()
    sign_in(client, "ananya")
    assert client.get(f"{API}/bookings/{made['id']}").status_code == 404  # looks the same as a missing one
    assert client.get(f"{API}/bookings/no-such-id").status_code == 404
    client.post(f"{API}/auth/signout")
    assert client.get(f"{API}/bookings/{made['id']}").status_code == 401
    assert client.get(f"{API}/me/bookings").status_code == 401


def seeded_for(guest: str):
    return [(slug, off, n) for slug, g, off, n in BOOKINGS if g == guest]


def test_trips_split_into_upcoming_and_past(client, seeded):
    sign_in(client, "rohan")
    mine = seeded_for("rohan")
    past = [m for m in mine if m[1] + m[2] <= 0]
    upcoming = [m for m in mine if m[1] + m[2] > 0]

    everything = client.get(f"{API}/me/bookings", params={"page_size": 50}).json()
    assert everything["total"] == len(mine)
    up = client.get(f"{API}/me/bookings", params={"phase": "upcoming", "page_size": 50}).json()
    old = client.get(f"{API}/me/bookings", params={"phase": "past", "page_size": 50}).json()
    assert (up["total"], old["total"]) == (len(upcoming), len(past)) and up["total"] > 0 and old["total"] > 0
    assert all(i["phase"] == "upcoming" for i in up["items"]) and all(i["phase"] == "past" for i in old["items"])
    assert [i["check_in"] for i in up["items"]] == sorted(i["check_in"] for i in up["items"])  # soonest first
    assert [i["check_in"] for i in old["items"]] == sorted((i["check_in"] for i in old["items"]), reverse=True)

    own_ids = {b.id for b in seeded.scalars(select(Booking).where(Booking.guest_id == stable_id("user", "rohan")))}
    assert {i["id"] for i in everything["items"]} == own_ids  # nobody else's trips


def test_trips_paginate_and_validate_phase(client, seeded):
    sign_in(client, "rohan")
    total = len(seeded_for("rohan"))
    first = client.get(f"{API}/me/bookings", params={"page_size": 4}).json()
    last = client.get(f"{API}/me/bookings", params={"page_size": 4, "page": first["total_pages"]}).json()
    assert first["total"] == total and len(first["items"]) == 4 and 0 < len(last["items"]) <= 4
    assert client.get(f"{API}/me/bookings", params={"phase": "soon"}).status_code == 422
    sign_in(client, "meera")  # a host with a trip of her own
    assert client.get(f"{API}/me/bookings").json()["total"] == len(seeded_for("meera"))


def test_a_stay_in_progress_counts_as_upcoming(client, seeded, monkeypatch):
    sign_in(client, "rohan")
    made = book(client, 40, 44).json()
    monkeypatch.setattr(clock, "today", lambda: TODAY + timedelta(days=42))  # mid-stay
    assert client.get(f"{API}/bookings/{made['id']}").json()["phase"] == "upcoming"
    monkeypatch.setattr(clock, "today", lambda: TODAY + timedelta(days=44))  # checkout day
    assert client.get(f"{API}/bookings/{made['id']}").json()["phase"] == "past"


# ---- the locking itself ----


def booking_in(listing_id: str, a: int, b: int, guests=2) -> BookingIn:
    return BookingIn(
        listing_id=listing_id,
        check_in=TODAY + timedelta(days=a),
        check_out=TODAY + timedelta(days=b),
        guests=guests,
        quote_fingerprint=quote_fingerprint_for_listing(listing_id, a, b, guests),
    )


_nightly = {}


def quote_fingerprint_for_listing(listing_id, a, b, guests):
    from app.services import pricing

    nightly, cleaning = _nightly[listing_id]
    price = pricing.compute_price(nightly, cleaning, b - a)
    return pricing.fingerprint(listing_id, TODAY + timedelta(days=a), TODAY + timedelta(days=b), guests, price)


def race(engine, jobs):
    """Run each (guest, request, key) in its own thread, own session, own connection, all released together."""
    gate = threading.Barrier(len(jobs))
    results = [None] * len(jobs)

    def run(i, guest_key, data, key):
        with sessionmaker(engine, expire_on_commit=False)() as session:
            gate.wait()
            try:
                booking, created = booking_service.create(session, stable_id("user", guest_key), data, key)
                results[i] = ("ok", booking.id, created)
            except Exception as exc:  # AppError carries .code
                results[i] = ("err", getattr(exc, "code", repr(exc)))

    threads = [threading.Thread(target=run, args=(i, *job)) for i, job in enumerate(jobs)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    return results


@pytest.fixture
def racing(seeded, engine):
    listing = seeded.get(Listing, ANJUNA)
    _nightly[ANJUNA] = (listing.nightly_price_minor, listing.cleaning_fee_minor)
    return engine


def test_two_guests_racing_for_the_same_nights_get_one_booking(racing, seeded):
    for round_no in range(6):  # repeat: a race that passes once proves little
        a = 50 + round_no * 10
        results = race(
            racing,
            [("rohan", booking_in(ANJUNA, a, a + 3), f"race-rohan-{round_no}"), ("ananya", booking_in(ANJUNA, a + 1, a + 4), f"race-ananya-{round_no}")],
        )
        winners = [r for r in results if r[0] == "ok"]
        losers = [r for r in results if r[0] == "err"]
        assert len(winners) == 1 and losers == [("err", "DATES_UNAVAILABLE")], results
    rows = seeded.scalars(select(Booking).where(Booking.listing_id == ANJUNA, Booking.check_in >= TODAY + timedelta(days=50))).all()
    assert len(rows) == 6  # one per round, never two


def test_back_to_back_stays_both_win_a_race(racing, seeded):
    results = race(
        racing,
        [("rohan", booking_in(ANJUNA, 70, 73), "adj-rohan-0001"), ("ananya", booking_in(ANJUNA, 73, 76), "adj-ananya-001")],
    )
    assert [r[0] for r in results] == ["ok", "ok"]


def test_the_same_request_sent_twice_at_once_makes_one_booking(racing, seeded):
    data = booking_in(ANJUNA, 80, 83)
    results = race(racing, [("rohan", data, "twin-key-00001"), ("rohan", data, "twin-key-00001")])
    assert all(r[0] == "ok" for r in results), results
    assert results[0][1] == results[1][1]  # both got the same booking
    assert sorted(r[2] for r in results) == [False, True]  # one created it, one saw it
    count = seeded.scalar(select(func.count()).select_from(Booking).where(Booking.check_in == TODAY + timedelta(days=80)))
    assert count == 1


def test_the_decision_is_one_atomic_insert_with_no_explicit_lock(client, seeded, engine):
    seen = []

    @event.listens_for(engine, "before_cursor_execute")
    def record(conn, cursor, statement, *rest):
        seen.append(" ".join(statement.split()))

    sign_in(client, "rohan")
    fp = quote(client, 90, 92)["quote_fingerprint"]
    seen.clear()
    assert book(client, 90, 92, key="atomic-key-001", fingerprint=fp).status_code == 201
    inserts = [q for q in seen if q.startswith("INSERT INTO bookings")]
    assert len(inserts) == 1
    # Availability, price and archived state are all checked inside the INSERT itself.
    assert "SELECT" in inserts[0] and "NOT (EXISTS" in inserts[0] or "NOT EXISTS" in inserts[0]
    assert "nightly_price_minor =" in inserts[0] and "archived_at IS NULL" in inserts[0]
    assert not any("BEGIN IMMEDIATE" in q for q in seen)


def host_edits_after_the_checks(monkeypatch, engine, **changes):
    """Make the host edit the listing in the gap between the booking checks and the insert."""
    from app.services import listings as listing_service

    real = listing_service.build_quote
    done = []

    def build_then_edit(listing, *args):
        result = real(listing, *args)
        if not done:  # only the first call, which happens before the insert
            done.append(True)
            with sessionmaker(engine, expire_on_commit=False)() as other:
                row = other.get(Listing, ANJUNA)
                for field, value in changes.items():
                    setattr(row, field, value)
                other.commit()
        return result

    monkeypatch.setattr(listing_service, "build_quote", build_then_edit)


def test_a_price_edit_between_the_checks_and_the_insert_cannot_slip_through(client, seeded, engine, monkeypatch):
    sign_in(client, "rohan")
    fp = quote(client, 40, 42)["quote_fingerprint"]
    count = booking_count(seeded)
    host_edits_after_the_checks(monkeypatch, engine, nightly_price_minor=1200000)
    r = book(client, 40, 42, key="edit-key-00001", fingerprint=fp)
    assert r.status_code == 409 and r.json()["error"]["code"] == "PRICE_CHANGED"
    assert r.json()["error"]["quote"]["nightly_price_minor"] == 1200000
    assert booking_count(seeded) == count


def test_archiving_between_the_checks_and_the_insert_cannot_slip_through(client, seeded, engine, monkeypatch):
    sign_in(client, "rohan")
    fp = quote(client, 40, 42)["quote_fingerprint"]
    count = booking_count(seeded)
    host_edits_after_the_checks(monkeypatch, engine, archived_at=1)
    r = book(client, 40, 42, key="edit-key-00002", fingerprint=fp)
    assert r.status_code == 404
    assert booking_count(seeded) == count


def test_a_busy_database_gives_a_retryable_503(client, seeded, engine, tmp_path):
    import sqlite3

    sign_in(client, "rohan")
    fp = quote(client, 40, 42)["quote_fingerprint"]

    impatient = make_engine(str(engine.url), busy_timeout=0.2)
    factory = sessionmaker(impatient, expire_on_commit=False)

    def override():
        with factory() as session:
            yield session

    previous = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = override
    blocker = sqlite3.connect(engine.url.database, isolation_level=None)
    blocker.execute("BEGIN IMMEDIATE")  # someone else is writing
    try:
        r = book(client, 40, 42, key="busy-key-00001", fingerprint=fp)
    finally:
        blocker.execute("ROLLBACK")
        blocker.close()
        app.dependency_overrides[get_db] = previous
    assert r.status_code == 503 and r.json()["error"]["code"] == "DATABASE_BUSY"
    # Once the lock is free the same request goes through, so a client can simply retry.
    assert book(client, 40, 42, key="busy-key-00001", fingerprint=fp).status_code == 201
