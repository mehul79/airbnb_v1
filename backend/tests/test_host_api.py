"""Host side: create, edit, archive, dashboard and reservations, with ownership enforced by the API.

Seeded: the Anjuna villa belongs to Meera and is booked by Rohan, Ananya and Arjun (see BOOKINGS).
Arjun and Kavya host other listings; Rohan and Ananya host nothing.
"""
from sqlalchemy import func, select

from app.models import Booking, Listing, ListingPhoto
from app.seed import stable_id
from app.seed_data import DEMO_PASSWORD, USERS

API = "/api/v1"
ANJUNA = stable_id("listing", "anjuna-pool-villa")
EMAILS = {key: email for key, email, _ in USERS}

NEW_LISTING = {
    "title": "  Hilltop cottage near Kasol  ",
    "description": "A quiet two-bedroom cottage above the river.",
    "city": "Kasol",
    "region": "Himachal Pradesh",
    "country": "India",
    "location_label": "Kasol, Himachal Pradesh",
    "latitude": 32.0098,
    "longitude": 77.3145,
    "property_type": "cottage",
    "category": "cabins",
    "max_guests": 4,
    "bedrooms": 2,
    "beds": 2,
    "bathrooms": 1.5,
    "nightly_price_minor": 450000,
    "cleaning_fee_minor": 50000,
    "photos": [
        {"url": "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8", "alt_text": "Cottage at dusk"},
        {"url": "https://example.com/second.jpg", "alt_text": ""},
    ],
    "amenities": ["wifi", "kitchen"],
}


def sign_in(client, who):
    r = client.post(f"{API}/auth/signin", json={"email": EMAILS[who], "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text


def create(client, **overrides):
    return client.post(f"{API}/host/listings", json={**NEW_LISTING, **overrides})


# ---- create ----


def test_every_host_endpoint_needs_a_session(client, seeded):
    for method, path in [
        ("get", "/host/listings"),
        ("get", f"/host/listings/{ANJUNA}"),
        ("post", "/host/listings"),
        ("patch", f"/host/listings/{ANJUNA}"),
        ("delete", f"/host/listings/{ANJUNA}"),
        ("get", "/host/bookings"),
    ]:
        assert getattr(client, method)(f"{API}{path}").status_code == 401, path


def test_anyone_can_create_and_it_appears_in_explore(client, seeded, db):
    sign_in(client, "rohan")  # Rohan hosts nothing yet: creating a listing is what makes him a host
    r = create(client)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "Hilltop cottage near Kasol"  # trimmed
    assert body["amenities"] == ["kitchen", "wifi"]  # sorted by slug
    assert [p["position"] for p in body["photos"]] == [0, 1]
    assert [p["source"] for p in body["photos"]] == ["unsplash", "url"]
    assert body["photos"][1]["alt_text"] == "Hilltop cottage near Kasol"  # empty alt falls back to the title

    host_id = db.scalar(select(Listing.host_id).where(Listing.id == body["id"]))
    assert host_id == stable_id("user", "rohan")  # the server set it, not the client

    found = client.get(f"{API}/listings", params={"location": "Kasol"}).json()
    assert [i["id"] for i in found["items"]] == [body["id"]]
    assert found["items"][0]["photo_url"].endswith("0a90ebb6d2d8")


def test_client_cannot_choose_the_host(client, seeded, db):
    sign_in(client, "rohan")
    r = create(client, host_id=stable_id("user", "meera"))
    assert r.status_code == 201  # unknown keys are ignored...
    assert db.scalar(select(Listing.host_id).where(Listing.id == r.json()["id"])) == stable_id("user", "rohan")  # ...never trusted


def test_create_validation(client, seeded, db):
    sign_in(client, "rohan")
    before = db.scalar(select(func.count()).select_from(Listing))
    bad = {
        "title": "   ",
        "photos": [],
        "nightly_price_minor": 0,
        "max_guests": 0,
        "category": "nonsense",
        "amenities": ["wifi", "hot-tub"],
    }
    r = create(client, **bad)
    fields = r.json()["error"]["fields"]
    assert r.status_code == 422
    assert {"title", "photos", "nightly_price_minor", "max_guests", "category"} <= fields.keys()

    for photos in (
        [{"url": "http://example.com/a.jpg"}],  # not https
        [{"url": "javascript:alert(1)"}],
        [{"url": "https://example.com/a b.jpg"}],  # whitespace
        [{"url": "https://example.com/a.jpg"}, {"url": "https://example.com/a.jpg"}],  # duplicate
        [{"url": f"https://example.com/{i}.jpg"} for i in range(21)],  # too many
    ):
        r = create(client, photos=photos)
        assert r.status_code == 422 and "photos" in r.json()["error"]["fields"], photos

    r = create(client, amenities=["wifi", "hot-tub"])
    assert r.status_code == 422 and r.json()["error"]["code"] == "UNKNOWN_AMENITY"
    assert db.scalar(select(func.count()).select_from(Listing)) == before  # nothing half-saved


# ---- ownership ----


def test_other_users_cannot_read_edit_or_archive_your_listing(client, seeded, db):
    sign_in(client, "arjun")  # not Meera
    assert client.get(f"{API}/host/listings/{ANJUNA}").status_code == 404
    assert client.patch(f"{API}/host/listings/{ANJUNA}", json={"title": "Hijacked"}).status_code == 404
    assert client.delete(f"{API}/host/listings/{ANJUNA}").status_code == 404
    db.expire_all()
    anjuna = db.get(Listing, ANJUNA)
    assert anjuna.title != "Hijacked" and anjuna.archived_at is None


def test_dashboard_lists_only_my_listings(client, seeded):
    sign_in(client, "meera")
    mine = client.get(f"{API}/host/listings").json()["items"]
    assert ANJUNA in {i["id"] for i in mine}
    anjuna = next(i for i in mine if i["id"] == ANJUNA)
    assert anjuna["upcoming_bookings"] >= 2 and anjuna["photo_url"]
    client.post(f"{API}/auth/signout")
    sign_in(client, "ananya")
    assert client.get(f"{API}/host/listings").json() == {"items": []}


# ---- edit ----


def test_patch_changes_only_what_was_sent_and_replaces_lists(client, seeded, db):
    sign_in(client, "rohan")
    listing_id = create(client).json()["id"]
    r = client.patch(
        f"{API}/host/listings/{listing_id}",
        json={"nightly_price_minor": 500000, "amenities": ["pool"], "photos": [{"url": "https://example.com/new.jpg"}]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nightly_price_minor"] == 500000 and body["title"] == "Hilltop cottage near Kasol"
    assert body["amenities"] == ["pool"]
    assert [p["url"] for p in body["photos"]] == ["https://example.com/new.jpg"]
    assert db.scalar(select(func.count()).select_from(ListingPhoto).where(ListingPhoto.listing_id == listing_id)) == 1


def test_patch_that_would_make_the_record_invalid_changes_nothing(client, seeded, db):
    sign_in(client, "rohan")
    created = create(client).json()
    r = client.patch(f"{API}/host/listings/{created['id']}", json={"title": "New title", "nightly_price_minor": -5})
    assert r.status_code == 422 and "nightly_price_minor" in r.json()["error"]["fields"]
    r = client.patch(f"{API}/host/listings/{created['id']}", json={"photos": []})
    assert r.status_code == 422 and "photos" in r.json()["error"]["fields"]
    r = client.patch(f"{API}/host/listings/{created['id']}", json={"amenities": ["wifi", "hot-tub"]})
    assert r.status_code == 422
    assert client.patch(f"{API}/host/listings/{created['id']}", json={"host_id": "x"}).status_code == 422  # not editable
    after = client.get(f"{API}/host/listings/{created['id']}").json()
    assert after == created  # not even the valid title went in


def test_editing_the_price_does_not_change_existing_bookings(client, seeded, db):
    sign_in(client, "meera")
    before = db.scalar(select(Booking.total_minor).where(Booking.listing_id == ANJUNA).order_by(Booking.id))
    assert client.patch(f"{API}/host/listings/{ANJUNA}", json={"nightly_price_minor": 9_999_900, "title": "Renamed"}).status_code == 200
    db.expire_all()
    assert db.scalar(select(Booking.total_minor).where(Booking.listing_id == ANJUNA).order_by(Booking.id)) == before
    title = db.scalar(select(Booking.listing_title_snapshot).where(Booking.listing_id == ANJUNA).limit(1))
    assert title != "Renamed"  # the trip still shows what the guest booked


# ---- archive ----


def test_archive_hides_the_listing_but_keeps_trips_readable(client, seeded, db):
    sign_in(client, "meera")
    assert client.delete(f"{API}/host/listings/{ANJUNA}").status_code == 204
    assert client.delete(f"{API}/host/listings/{ANJUNA}").status_code == 204  # repeating is harmless

    assert client.get(f"{API}/listings/{ANJUNA}").status_code == 404
    assert ANJUNA not in {i["id"] for i in client.get(f"{API}/listings", params={"page_size": 48}).json()["items"]}
    assert ANJUNA not in {i["id"] for i in client.get(f"{API}/host/listings").json()["items"]}
    archived = client.get(f"{API}/host/listings", params={"include_archived": True}).json()["items"]
    assert next(i for i in archived if i["id"] == ANJUNA)["archived_at"] is not None
    assert client.get(f"{API}/host/listings/{ANJUNA}").json()["archived_at"] is not None  # owner can still read it
    assert client.patch(f"{API}/host/listings/{ANJUNA}", json={"title": "x"}).status_code == 409

    client.post(f"{API}/auth/signout")
    sign_in(client, "rohan")  # a guest with a booking on it
    trips = client.get(f"{API}/me/bookings").json()["items"]
    assert any(t["listing_id"] == ANJUNA for t in trips)  # still readable, with its snapshot


def test_cannot_book_an_archived_listing(client, seeded):
    sign_in(client, "meera")
    client.delete(f"{API}/host/listings/{ANJUNA}")
    client.post(f"{API}/auth/signout")
    sign_in(client, "ananya")
    r = client.post(f"{API}/listings/{ANJUNA}/quote", json={"check_in": "2030-01-10", "check_out": "2030-01-12", "guests": 2})
    assert r.status_code == 404


# ---- reservations ----


def test_reservations_show_my_listings_only_with_limited_guest_info(client, seeded):
    sign_in(client, "meera")
    page = client.get(f"{API}/host/bookings", params={"listing_id": ANJUNA, "page_size": 50}).json()
    assert page["total"] >= 4
    first = page["items"][0]
    assert {"guest_name", "check_in", "check_out", "guests", "total_minor", "listing_title", "phase"} <= first.keys()
    assert "email" not in str(page).lower() and "guest_id" not in first
    assert {i["guest_name"] for i in page["items"]} >= {"Rohan Verma", "Ananya Iyer"}

    upcoming = client.get(f"{API}/host/bookings", params={"phase": "upcoming", "page_size": 50}).json()["items"]
    assert upcoming and all(i["phase"] == "upcoming" for i in upcoming)
    assert [i["check_in"] for i in upcoming] == sorted(i["check_in"] for i in upcoming)  # soonest first

    client.post(f"{API}/auth/signout")
    sign_in(client, "ananya")  # hosts nothing
    assert client.get(f"{API}/host/bookings").json()["total"] == 0
    client.post(f"{API}/auth/signout")
    sign_in(client, "arjun")  # hosts others, but not this listing
    other = client.get(f"{API}/host/bookings", params={"listing_id": ANJUNA}).json()
    assert other["total"] == 0 and other["items"] == []


# ---- Cloudinary uploads ----


def test_signing_needs_a_session_and_the_secret_never_leaves(client, seeded, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "cloudinary_cloud_name", "democloud")
    monkeypatch.setattr(settings, "cloudinary_api_key", "12345")
    monkeypatch.setattr(settings, "cloudinary_api_secret", "topsecret")
    assert client.post(f"{API}/host/uploads/sign").status_code == 401

    sign_in(client, "rohan")
    r = client.post(f"{API}/host/uploads/sign")
    assert r.status_code == 200
    body = r.json()
    assert "topsecret" not in r.text
    assert body["cloud_name"] == "democloud" and body["api_key"] == "12345"
    assert body["folder"] == f"airbnb-clone/listings/{stable_id('user', 'rohan')}"  # one folder per user

    # Cloudinary's rule: SHA-1 of the sorted "k=v&k=v" params with the secret appended.
    import hashlib

    signed = f"allowed_formats={body['allowed_formats']}&folder={body['folder']}&timestamp={body['timestamp']}topsecret"
    assert body["signature"] == hashlib.sha1(signed.encode()).hexdigest()


def test_signing_says_so_when_uploads_are_not_configured(client, seeded, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "cloudinary_api_secret", "")
    sign_in(client, "rohan")
    r = client.post(f"{API}/host/uploads/sign")
    assert r.status_code == 503 and r.json()["error"]["code"] == "UPLOADS_UNAVAILABLE"


def test_cloudinary_photos_keep_their_public_id():
    from app.services.uploads import cloudinary_public_id

    assert cloudinary_public_id("https://res.cloudinary.com/demo/image/upload/v1712/airbnb-clone/listings/u1/cabin.jpg") == "airbnb-clone/listings/u1/cabin"
    assert cloudinary_public_id("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v9/a/b.webp") == "a/b"
    assert cloudinary_public_id("https://images.unsplash.com/photo-1") is None
    assert cloudinary_public_id("https://example.com/x/image/upload/v1/a.jpg") is None


def test_creating_with_an_uploaded_photo_stores_source_and_public_id(client, seeded, db):
    sign_in(client, "rohan")
    url = "https://res.cloudinary.com/demo/image/upload/v1712/airbnb-clone/listings/u1/cabin.jpg"
    r = create(client, photos=[{"url": url}])
    assert r.status_code == 201, r.text
    assert r.json()["photos"][0]["source"] == "cloudinary"
    stored = db.scalar(select(ListingPhoto).where(ListingPhoto.listing_id == r.json()["id"]))
    assert stored.cloudinary_public_id == "airbnb-clone/listings/u1/cabin"
