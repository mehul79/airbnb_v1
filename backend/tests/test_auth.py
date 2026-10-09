from sqlalchemy import select

from app.models import UserSession
from app.models.user import now

SIGNUP = {"email": "Ada@Example.com", "password": "correct horse", "display_name": "Ada", "age": 30}


def test_signup_signs_in_and_me_returns_user(client):
    r = client.post("/api/v1/auth/signup", json=SIGNUP)
    assert r.status_code == 201
    assert r.json()["email"] == "ada@example.com"  # lowercased
    assert "password" not in r.text and "password_hash" not in r.text
    set_cookie = r.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "samesite=lax" in set_cookie
    assert client.get("/api/v1/me").json()["display_name"] == "Ada"


def test_token_is_stored_hashed(client, db):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    raw = client.cookies.get("session")
    row = db.scalar(select(UserSession))
    assert row.token_hash != raw and len(row.token_hash) == 64


def test_duplicate_email_is_case_insensitive(client):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    r = client.post("/api/v1/auth/signup", json={**SIGNUP, "email": "ADA@example.com"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "EMAIL_TAKEN"


def test_validation_errors_use_envelope_with_fields(client):
    r = client.post("/api/v1/auth/signup", json={"email": "nope", "password": "short", "display_name": ""})
    err = r.json()["error"]
    assert r.status_code == 422 and err["code"] == "VALIDATION_ERROR"
    assert {"email", "password", "display_name"} <= err["fields"].keys()
    assert err["request_id"]


def test_signin_wrong_password_and_unknown_email_look_the_same(client):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    client.post("/api/v1/auth/signout")
    bad = client.post("/api/v1/auth/signin", json={"email": "ada@example.com", "password": "wrong password"})
    unknown = client.post("/api/v1/auth/signin", json={"email": "who@example.com", "password": "wrong password"})
    assert bad.status_code == unknown.status_code == 401
    assert bad.json()["error"]["message"] == unknown.json()["error"]["message"]


def test_signin_then_signout_ends_session(client, db):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    client.post("/api/v1/auth/signout")
    assert client.get("/api/v1/me").status_code == 401

    r = client.post("/api/v1/auth/signin", json={"email": "ADA@example.com", "password": "correct horse"})
    assert r.status_code == 200
    assert client.get("/api/v1/me").status_code == 200

    old_token = client.cookies.get("session")
    assert client.post("/api/v1/auth/signout").status_code == 204
    assert db.scalar(select(UserSession)) is None
    # Replaying the old cookie after signout must fail: the server row is gone.
    client.cookies.set("session", old_token)
    assert client.get("/api/v1/me").status_code == 401


def test_expired_session_is_rejected(client, db):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    row = db.scalar(select(UserSession))
    row.expires_at = now() - 1
    db.commit()
    assert client.get("/api/v1/me").status_code == 401


def test_mutation_from_other_origin_is_forbidden(client):
    r = client.post("/api/v1/auth/signup", json=SIGNUP, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "BAD_ORIGIN"


def test_me_without_cookie_is_401(client):
    assert client.get("/api/v1/me").status_code == 401


def test_health(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_check_email_reports_whether_account_exists(client):
    assert client.post("/api/v1/auth/check", json={"email": "ada@example.com"}).json() == {"exists": False}
    client.post("/api/v1/auth/signup", json=SIGNUP)
    assert client.post("/api/v1/auth/check", json={"email": "ADA@example.com"}).json() == {"exists": True}


def test_signup_requires_adult_age_and_stores_it(client):
    r = client.post("/api/v1/auth/signup", json={**SIGNUP, "age": 17})
    assert r.status_code == 422 and "age" in r.json()["error"]["fields"]
    assert client.post("/api/v1/auth/signup", json=SIGNUP).json()["age"] == 30


def test_patch_me_updates_display_name_only(client):
    assert client.patch("/api/v1/me", json={"display_name": "Nope"}).status_code == 401
    client.post("/api/v1/auth/signup", json=SIGNUP)
    r = client.patch("/api/v1/me", json={"display_name": "  Ada L  ", "email": "evil@example.com", "age": 99})
    assert r.status_code == 200
    body = client.get("/api/v1/me").json()
    assert body["display_name"] == "Ada L" and body["email"] == "ada@example.com" and body["age"] == 30
    assert client.patch("/api/v1/me", json={"display_name": ""}).status_code == 422
