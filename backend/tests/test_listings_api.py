"""Listing search, detail, reviews, availability and quotes, against the real seed.

Expected results come from app/seed_data.py (the source of the seed), not from the code under test.
Dates are relative to the pinned TODAY. The seeded Anjuna villa is booked days 7-12 and 25-28.
"""
from datetime import timedelta

from sqlalchemy import func, select

from app.models import Listing, Review
from app.seed import stable_id
from app.seed_data import LISTINGS, REVIEW_COUNTS
from tests.conftest import TODAY

API = "/api/v1"
ANJUNA = stable_id("listing", "anjuna-pool-villa")


def day(n: int) -> str:
    return (TODAY + timedelta(days=n)).isoformat()


def search(client, **params):
    r = client.get(f"{API}/listings", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def titles(page):
    return {item["title"] for item in page["items"]}


def want(predicate):
    return {s.title for s in LISTINGS if predicate(s)}


# ---- search ----


def test_pagination_has_no_gaps_or_repeats(client, seeded):
    one = search(client)
    two = search(client, page=2)
    assert (one["total"], one["total_pages"], one["page_size"]) == (len(LISTINGS), -(-len(LISTINGS) // 12), 12)
    assert len(one["items"]) == len(two["items"]) == 12
    ids = [i["id"] for i in one["items"] + two["items"]]
    assert len(set(ids)) == 24  # two full pages, none repeated
    # Newest first: the seed gives the first listing in seed_data the newest created_at.
    assert one["items"][0]["title"] == LISTINGS[0].title
    beyond = search(client, page=-(-len(LISTINGS) // 12) + 1)
    assert beyond["items"] == [] and beyond["total"] == len(LISTINGS)


def test_page_size_is_capped_and_page_must_be_positive(client, seeded):
    assert client.get(f"{API}/listings", params={"page_size": 49}).status_code == 422
    r = client.get(f"{API}/listings", params={"page": 0})
    assert r.status_code == 422 and "page" in r.json()["error"]["fields"]
    assert len(search(client, page_size=5)["items"]) == 5


def test_card_fields(client, seeded):
    card = search(client)["items"][0]
    assert card["photo_url"].startswith("https://images.unsplash.com/photo-")
    assert card["photo_source"] == "unsplash" and card["photo_alt"]
    assert card["currency"] == "INR" and card["nightly_price_minor"] == LISTINGS[0].price * 100
    assert "description" not in card


def test_location_is_case_insensitive_and_literal(client, seeded):
    assert search(client, location="goa")["total"] == search(client, location="GOA")["total"] == len(want(lambda s: s.region == "Goa"))
    assert titles(search(client, location="anjuna")) == want(lambda s: s.city == "Anjuna")
    assert search(client, location="himachal")["total"] == len(want(lambda s: s.region == "Himachal Pradesh"))
    assert search(client, location="india")["total"] == len(LISTINGS)
    assert search(client, location="   ")["total"] == len(LISTINGS)
    assert search(client, location="nowhere")["total"] == 0
    assert search(client, location="%")["total"] == 0  # not a wildcard


def test_category_and_property_type(client, seeded):
    assert titles(search(client, category="pools", page_size=48)) == want(lambda s: s.category == "pools")
    assert titles(search(client, property_type="villa", page_size=48)) == want(lambda s: s.property_type == "villa")
    both = search(client, category="pools", property_type="villa", page_size=48)
    assert titles(both) == want(lambda s: s.category == "pools" and s.property_type == "villa")
    r = client.get(f"{API}/listings", params={"category": "castle"})
    assert r.status_code == 422 and "category" in r.json()["error"]["fields"]


def test_price_range_is_inclusive_and_checked(client, seeded):
    exact = search(client, min_price_minor=950000, max_price_minor=950000)
    assert titles(exact) == {"Whitewashed pool villa near Anjuna beach"}
    mid = search(client, min_price_minor=500000, max_price_minor=900000, page_size=48)
    assert titles(mid) == want(lambda s: 5000 <= s.price <= 9000)
    assert titles(search(client, max_price_minor=350000, page_size=48)) == want(lambda s: s.price <= 3500)
    r = client.get(f"{API}/listings", params={"min_price_minor": 2, "max_price_minor": 1})
    assert r.status_code == 422 and "min_price_minor" in r.json()["error"]["fields"]


def test_every_requested_amenity_must_match(client, seeded):
    one = search(client, amenity="pool", page_size=48)
    both = search(client, amenity=["pool", "breakfast"], page_size=48)
    assert titles(one) == want(lambda s: "pool" in s.amenities)
    assert titles(both) == want(lambda s: {"pool", "breakfast"} <= set(s.amenities))
    assert 0 < both["total"] < one["total"]
    assert search(client, amenity=["pool", "pool"], page_size=48)["total"] == one["total"]  # repeats do not matter
    r = client.get(f"{API}/listings", params={"amenity": ["pool", "jacuzzi"]})
    assert r.status_code == 422 and "amenity" in r.json()["error"]["fields"]


def test_guests_filter_and_combined_filters(client, seeded):
    assert titles(search(client, guests=9, page_size=48)) == want(lambda s: s.max_guests >= 9)
    assert search(client, guests=50)["total"] == 0
    combined = search(
        client, location="goa", category="pools", max_price_minor=1000000, amenity="air_conditioning", guests=3, page_size=48
    )
    assert titles(combined) == want(
        lambda s: s.region == "Goa"
        and s.category == "pools"
        and s.price <= 10000
        and "air_conditioning" in s.amenities
        and s.max_guests >= 3
    )
    assert combined["total"] > 0
    assert search(client, location="goa", category="pools", page_size=48)["total"] >= combined["total"]


def test_dates_hide_listings_with_overlapping_bookings(client, seeded):
    villa = "Whitewashed pool villa near Anjuna beach"

    def shown(a, b):
        return villa in titles(search(client, check_in=day(a), check_out=day(b), page_size=48))

    assert not shown(8, 10)  # inside the booked days 7-12
    assert not shown(5, 8)  # overlaps the start
    assert not shown(11, 14)  # overlaps the end
    assert not shown(5, 20)  # contains it
    assert shown(5, 7)  # ends on the day the other guest arrives
    assert shown(12, 14)  # starts on the day the other guest leaves
    assert shown(13, 24)  # between the two bookings
    # The Alleppey houseboat is also booked on days 6-9, so exactly those two listings disappear.
    left = titles(search(client, check_in=day(8), check_out=day(10), page_size=48))
    assert want(lambda s: True) - left == {villa, "Traditional houseboat on Vembanad Lake"}


def test_date_validation_in_search(client, seeded):
    def fields(**params):
        r = client.get(f"{API}/listings", params=params)
        assert r.status_code == 422
        return r.json()["error"]["fields"]

    assert "check_out" in fields(check_in=day(3))  # half a pair
    assert "check_in" in fields(check_out=day(3))
    assert "check_out" in fields(check_in=day(5), check_out=day(5))
    assert "check_out" in fields(check_in=day(6), check_out=day(5))
    assert "check_in" in fields(check_in=day(-1), check_out=day(2))
    assert search(client, check_in=day(0), check_out=day(1))["total"] > 0  # today is allowed


def test_ratings_come_from_reviews_and_new_listings_have_none(client, seeded):
    items = search(client, page_size=48)["items"]
    by_title = {i["title"]: i for i in items}
    villa_id = ANJUNA
    avg, n = seeded.execute(select(func.avg(Review.rating), func.count()).where(Review.listing_id == villa_id)).one()
    villa = by_title["Whitewashed pool villa near Anjuna beach"]
    assert villa["review_count"] == n == 3 and villa["rating"] == round(avg, 2)
    hut = by_title["Thatched beach hut in Arambol"]
    assert hut["rating"] is None and hut["review_count"] == 0
    assert sum(i["rating"] is None for i in items) == sum(n == 0 for n in REVIEW_COUNTS)


# ---- detail, reviews ----


def test_detail(client, seeded):
    r = client.get(f"{API}/listings/{ANJUNA}")
    assert r.status_code == 200
    body = r.json()
    assert [p["position"] for p in body["photos"]] == [0, 1, 2]
    assert {a["slug"] for a in body["amenities"]} == set(LISTINGS[0].amenities)
    assert body["host"]["display_name"] == "Meera Kapoor"
    assert "email" not in r.text and "password" not in r.text
    assert body["review_count"] == 3 and body["rating"] is not None
    assert body["cleaning_fee_minor"] == LISTINGS[0].cleaning_fee * 100


def test_unknown_and_archived_listings_are_not_found_everywhere(client, seeded):
    missing = client.get(f"{API}/listings/does-not-exist")
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "NOT_FOUND"

    seeded.get(Listing, ANJUNA).archived_at = 1
    seeded.commit()
    assert client.get(f"{API}/listings/{ANJUNA}").status_code == 404
    assert client.get(f"{API}/listings/{ANJUNA}/reviews").status_code == 404
    assert client.get(f"{API}/listings/{ANJUNA}/availability").status_code == 404
    quote = {"check_in": day(40), "check_out": day(41), "guests": 1}
    assert client.post(f"{API}/listings/{ANJUNA}/quote", json=quote).status_code == 404
    assert search(client)["total"] == len(LISTINGS) - 1  # the archived villa is gone


def test_reviews_are_paged_newest_first_without_emails(client, seeded):
    first = client.get(f"{API}/listings/{ANJUNA}/reviews", params={"page_size": 2}).json()
    second = client.get(f"{API}/listings/{ANJUNA}/reviews", params={"page_size": 2, "page": 2}).json()
    assert (first["total"], first["total_pages"], len(first["items"]), len(second["items"])) == (3, 2, 2, 1)
    dates = [i["created_at"] for i in first["items"] + second["items"]]
    assert dates == sorted(dates, reverse=True)
    assert set(first["items"][0]["author"]) == {"display_name", "avatar_url"}


# ---- availability ----


def test_availability_lists_future_occupied_ranges_only_as_dates(client, seeded):
    r = client.get(f"{API}/listings/{ANJUNA}/availability")
    assert r.status_code == 200
    assert r.json() == {
        "occupied": [
            {"check_in": day(7), "check_out": day(12)},
            {"check_in": day(25), "check_out": day(28)},
        ]
    }
    narrow = client.get(f"{API}/listings/{ANJUNA}/availability", params={"from": day(0), "to": day(10)}).json()
    assert narrow["occupied"] == [{"check_in": day(7), "check_out": day(12)}]
    # A window that ends exactly when a booking starts does not include it.
    edge = client.get(f"{API}/listings/{ANJUNA}/availability", params={"from": day(0), "to": day(7)}).json()
    assert edge["occupied"] == []


def test_availability_window_limits(client, seeded):
    url = f"{API}/listings/{ANJUNA}/availability"
    assert client.get(url, params={"from": day(5), "to": day(5)}).status_code == 422
    assert client.get(url, params={"from": day(5), "to": day(1)}).status_code == 422
    assert client.get(url, params={"from": day(0), "to": day(367)}).status_code == 422
    assert client.get(url, params={"from": day(0), "to": day(366)}).status_code == 200


# ---- quote ----


def quote(client, listing_id=ANJUNA, **body):
    return client.post(f"{API}/listings/{listing_id}/quote", json=body)


def test_quote_itemises_the_price(client, seeded):
    r = quote(client, check_in=day(30), check_out=day(32), guests=2)
    assert r.status_code == 200
    q = r.json()
    assert q["nights"] == 2 and q["nightly_price_minor"] == 950000
    assert (q["subtotal_minor"], q["cleaning_fee_minor"], q["service_fee_minor"], q["total_minor"]) == (
        1900000,
        150000,
        190000,
        2240000,
    )
    assert len(q["quote_fingerprint"]) == 64


def test_quote_fingerprint_is_stable_and_follows_the_price(client, seeded):
    body = dict(check_in=day(30), check_out=day(32), guests=2)
    a = quote(client, **body).json()["quote_fingerprint"]
    assert a == quote(client, **body).json()["quote_fingerprint"]
    assert a != quote(client, **{**body, "guests": 3}).json()["quote_fingerprint"]
    seeded.get(Listing, ANJUNA).nightly_price_minor = 960000
    seeded.commit()
    assert a != quote(client, **body).json()["quote_fingerprint"]


def test_quote_rejects_bad_stays(client, seeded):
    past = quote(client, check_in=day(-1), check_out=day(2), guests=2)
    assert past.status_code == 422 and "check_in" in past.json()["error"]["fields"]
    too_many = quote(client, check_in=day(30), check_out=day(32), guests=7)  # the villa fits 6
    assert too_many.status_code == 422 and "guests" in too_many.json()["error"]["fields"]
    assert quote(client, check_in=day(30), check_out=day(30), guests=2).status_code == 422
    assert quote(client, check_in="not-a-date", check_out=day(32), guests=2).status_code == 422
    assert quote(client, listing_id="nope", check_in=day(30), check_out=day(32), guests=2).status_code == 404


def test_quote_refuses_taken_nights_but_allows_adjacent_stays(client, seeded):
    taken = quote(client, check_in=day(10), check_out=day(14), guests=2)
    assert taken.status_code == 409 and taken.json()["error"]["code"] == "DATES_UNAVAILABLE"
    assert quote(client, check_in=day(12), check_out=day(14), guests=2).status_code == 200  # arrives on checkout day
    assert quote(client, check_in=day(5), check_out=day(7), guests=2).status_code == 200  # leaves on arrival day


def test_quote_post_needs_the_frontend_origin(client, seeded):
    r = client.post(
        f"{API}/listings/{ANJUNA}/quote",
        json={"check_in": day(30), "check_out": day(32), "guests": 2},
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 403


# ---- amenities ----


def test_amenities_vocabulary(client, seeded):
    items = client.get(f"{API}/amenities").json()
    assert len(items) == 12
    assert [i["name"] for i in items] == sorted(i["name"] for i in items)
    assert {"slug", "name", "icon_key"} == set(items[0])
