"""Saving listings: per-user, idempotent, ordered, and hidden once a listing is archived."""
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.models import Favorite, Listing
from app.seed import stable_id
from app.seed_data import DEMO_PASSWORD, USERS

API = "/api/v1"
ANJUNA = stable_id("listing", "anjuna-pool-villa")
EMAILS = {key: email for key, email, _ in USERS}


def sign_in(client, who):
    r = client.post(f"{API}/auth/signin", json={"email": EMAILS[who], "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text


def other_listing(db):
    return db.scalar(select(Listing.id).where(Listing.id != ANJUNA).order_by(Listing.id))


def test_everything_needs_a_session(client, seeded):
    assert client.get(f"{API}/me/favorites").status_code == 401
    assert client.get(f"{API}/me/favorites/ids").status_code == 401
    assert client.put(f"{API}/me/favorites/{ANJUNA}").status_code == 401
    assert client.delete(f"{API}/me/favorites/{ANJUNA}").status_code == 401


def test_save_is_idempotent_and_unsave_too(client, seeded, db):
    sign_in(client, "rohan")
    assert client.put(f"{API}/me/favorites/{ANJUNA}").status_code == 204
    assert client.put(f"{API}/me/favorites/{ANJUNA}").status_code == 204
    assert db.scalar(select(func.count()).select_from(Favorite)) == 1
    assert client.get(f"{API}/me/favorites/ids").json() == {"ids": [ANJUNA]}

    assert client.delete(f"{API}/me/favorites/{ANJUNA}").status_code == 204
    assert client.delete(f"{API}/me/favorites/{ANJUNA}").status_code == 204
    assert client.get(f"{API}/me/favorites/ids").json() == {"ids": []}


def test_unknown_listing_is_404_and_changes_nothing(client, seeded, db):
    sign_in(client, "rohan")
    r = client.put(f"{API}/me/favorites/not-a-listing")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
    assert db.scalar(select(func.count()).select_from(Favorite)) == 0


def test_favorites_are_private_per_user(client, seeded):
    sign_in(client, "rohan")
    client.put(f"{API}/me/favorites/{ANJUNA}")
    client.post(f"{API}/auth/signout")
    sign_in(client, "ananya")
    assert client.get(f"{API}/me/favorites/ids").json() == {"ids": []}
    assert client.get(f"{API}/me/favorites").json()["total"] == 0


def test_wishlist_is_newest_first_with_card_fields_and_pages(client, seeded, db):
    sign_in(client, "rohan")
    second = other_listing(db)
    client.put(f"{API}/me/favorites/{ANJUNA}")
    # Same-second saves tie on created_at, so pin the older one the way a real gap would.
    db.execute(Favorite.__table__.update().where(Favorite.listing_id == ANJUNA).values(created_at=1000))
    db.commit()
    client.put(f"{API}/me/favorites/{second}")

    body = client.get(f"{API}/me/favorites").json()
    assert [i["id"] for i in body["items"]] == [second, ANJUNA]
    assert body["total"] == 2 and body["total_pages"] == 1
    anjuna = body["items"][1]
    assert anjuna["photo_url"] and anjuna["nightly_price_minor"] > 0 and "rating" in anjuna

    first_page = client.get(f"{API}/me/favorites", params={"page_size": 1}).json()
    assert first_page["total_pages"] == 2 and [i["id"] for i in first_page["items"]] == [second]


def test_archived_listings_drop_out_of_the_wishlist(client, seeded, db):
    sign_in(client, "rohan")
    client.put(f"{API}/me/favorites/{ANJUNA}")
    db.execute(Listing.__table__.update().where(Listing.id == ANJUNA).values(archived_at=int(datetime.now(timezone.utc).timestamp())))
    db.commit()
    assert client.get(f"{API}/me/favorites/ids").json() == {"ids": []}
    assert client.get(f"{API}/me/favorites").json()["total"] == 0
    assert client.put(f"{API}/me/favorites/{ANJUNA}").status_code == 404
