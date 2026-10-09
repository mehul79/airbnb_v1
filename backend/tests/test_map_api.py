"""GET /listings/map: every match with coordinates, using the same filters as search."""
from datetime import timedelta

from app.models import Listing
from app.seed import stable_id
from app.seed_data import LISTINGS
from app.services import listings as listing_service
from tests.conftest import TODAY

API = "/api/v1"
ANJUNA = stable_id("listing", "anjuna-pool-villa")


def day(n: int) -> str:
    return (TODAY + timedelta(days=n)).isoformat()


def pins(client, **params):
    r = client.get(f"{API}/listings/map", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def search_ids(client, **params):
    r = client.get(f"{API}/listings", params={**params, "page_size": 48})
    assert r.status_code == 200, r.text
    return {i["id"] for i in r.json()["items"]}


def test_map_route_is_not_mistaken_for_a_listing_id(client, seeded):
    assert client.get(f"{API}/listings/map").status_code == 200


def test_map_returns_every_match_not_one_page(client, seeded):
    body = pins(client, page_size=12)  # a small page size must not shrink the map
    assert body["total"] == len(LISTINGS) and len(body["items"]) == len(LISTINGS)
    assert body["truncated"] is False


def test_pins_carry_what_a_bubble_and_its_card_need(client, seeded):
    item = pins(client)["items"][0]
    assert 6 < item["latitude"] < 38 and 67 < item["longitude"] < 98  # somewhere in India
    assert item["nightly_price_minor"] > 0 and item["photo_url"] and item["title"]
    assert {"rating", "review_count", "guest_favourite", "host_superhost"} <= item.keys()


def test_listing_cards_in_search_also_carry_coordinates(client, seeded):
    card = client.get(f"{API}/listings").json()["items"][0]
    assert isinstance(card["latitude"], float) and isinstance(card["longitude"], float)


def test_same_filters_as_search(client, seeded):
    for params in (
        {"location": "goa"},
        {"location": "himachal", "guests": 5},
        {"min_price_minor": 500000, "max_price_minor": 900000},
        {"amenity": ["pool", "wifi"]},
        {"category": "pools"},
        {"property_type": "villa", "location": "india"},
        {"check_in": day(8), "check_out": day(10)},  # inside the Anjuna villa's booked days
    ):
        assert {i["id"] for i in pins(client, **params)["items"]} == search_ids(client, **params), params
    assert ANJUNA not in {i["id"] for i in pins(client, check_in=day(8), check_out=day(10))["items"]}


def test_a_listing_without_coordinates_is_left_off_the_map_but_not_the_list(client, seeded):
    listing = seeded.get(Listing, ANJUNA)
    listing.latitude = None
    seeded.commit()
    body = pins(client)
    assert ANJUNA not in {i["id"] for i in body["items"]} and body["total"] == len(LISTINGS) - 1
    assert ANJUNA in search_ids(client)


def test_map_is_capped_and_says_so(client, seeded, monkeypatch):
    monkeypatch.setattr(listing_service, "MAP_LIMIT", 5)
    body = pins(client)
    assert len(body["items"]) == 5 and body["total"] == len(LISTINGS) and body["truncated"] is True


def test_bad_filters_are_rejected_like_search(client, seeded):
    r = client.get(f"{API}/listings/map", params={"min_price_minor": 900, "max_price_minor": 100})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_PRICE_RANGE"
    assert client.get(f"{API}/listings/map", params={"check_in": day(5)}).status_code == 422
