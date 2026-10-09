"""POST /listings/{id}/reviews: only after a stay has ended, once per home, by the signed-in guest."""
from sqlalchemy import delete, select

from app.models import Review
from app.seed import stable_id
from tests.test_bookings_api import API, EMAILS, sign_in

CHALET = stable_id("listing", "manali-riverside-chalet")  # rohan's stay ended 12 days ago
ANJUNA = stable_id("listing", "anjuna-pool-villa")  # rohan's other stay there is still upcoming
ROHAN = stable_id("user", "rohan")
GOOD = {"rating": 4, "body": "Quiet spot by the river, lovely host."}


def post(client, listing_id=CHALET, **body):
    return client.post(f"{API}/listings/{listing_id}/reviews", json={**GOOD, **body})


def forget_rohans_reviews(db):
    db.execute(delete(Review).where(Review.author_id == ROHAN))
    db.commit()


def test_sign_in_is_required(client, seeded):
    assert post(client).status_code == 401


def test_a_guest_whose_stay_ended_can_review_and_it_shows_up(client, seeded):
    forget_rohans_reviews(seeded)
    sign_in(client, "rohan")
    before = client.get(f"{API}/listings/{CHALET}").json()["review_count"]
    r = post(client, body="  Quiet spot by the river, lovely host.  ")
    assert r.status_code == 201, r.text
    assert r.json()["body"] == "Quiet spot by the river, lovely host."  # trimmed
    assert r.json()["author"]["display_name"]
    detail = client.get(f"{API}/listings/{CHALET}").json()
    assert detail["review_count"] == before + 1
    assert client.get(f"{API}/listings/{CHALET}/reviews").json()["items"][0]["id"] == r.json()["id"]


def test_one_review_per_home(client, seeded):
    forget_rohans_reviews(seeded)
    sign_in(client, "rohan")
    assert post(client).status_code == 201
    again = post(client, rating=1)
    assert again.status_code == 409 and again.json()["error"]["code"] == "ALREADY_REVIEWED"
    assert seeded.scalars(select(Review).where(Review.author_id == ROHAN, Review.listing_id == CHALET)).all().__len__() == 1


def test_no_finished_stay_no_review(client, seeded):
    forget_rohans_reviews(seeded)
    sign_in(client, "rohan")
    never = stable_id("listing", "panjim-sunny-apartment")
    r = post(client, never)
    assert r.status_code == 403 and r.json()["error"]["code"] == "NOT_ELIGIBLE"


def test_bad_reviews_are_rejected(client, seeded):
    forget_rohans_reviews(seeded)
    sign_in(client, "rohan")
    for bad in ({"rating": 0}, {"rating": 6}, {"body": "short"}, {"body": "         "}, {"body": "x" * 2001}):
        assert post(client, **bad).status_code == 422, bad


def test_the_author_comes_from_the_session_not_the_body(client, seeded):
    forget_rohans_reviews(seeded)
    sign_in(client, "rohan")
    r = post(client, author_id=stable_id("user", "meera"))
    assert r.status_code == 201
    assert seeded.scalar(select(Review.author_id).where(Review.id == r.json()["id"])) == ROHAN


def test_trips_say_which_stays_are_already_reviewed(client, seeded):
    forget_rohans_reviews(seeded)
    sign_in(client, "rohan")
    def chalet_trip():
        items = client.get(f"{API}/me/bookings", params={"phase": "past"}).json()["items"]
        return next(b for b in items if b["listing_id"] == CHALET)
    assert chalet_trip()["reviewed"] is False
    post(client)
    assert chalet_trip()["reviewed"] is True
