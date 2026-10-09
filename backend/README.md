# Backend

FastAPI + SQLAlchemy 2 + Alembic. Local development uses a SQLite file; in production the file sits on a persistent disk.

## Setup

```bash
cd backend
uv sync
cp .env.example .env            # defaults work for local development
uv run alembic upgrade head     # creates dev.db
uv run python -m app.seed       # demo data; safe to re-run, never overwrites edits
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                   # each test builds a temporary SQLite file via the real migrations
```

Docs at http://localhost:8000/docs. Everything is under `/api/v1`.

## Layout

`app/api` thin routers, `app/services` business rules, `app/models` SQLAlchemy tables, `app/schemas` request/response DTOs, `migrations/` Alembic.

## Auth (implemented)

| Endpoint | Purpose |
|---|---|
| `POST /auth/signup` | Create account, start session, set `session` cookie |
| `POST /auth/signin` | Check password, start session, set cookie |
| `POST /auth/signout` | Delete the session, clear cookie |
| `GET /me` | Current user, or 401 |

Passwords use stdlib scrypt. The cookie holds a random token; the database stores only its SHA-256. The cookie is HttpOnly, SameSite=Lax, and lasts 7 days. Non-GET requests must carry `Origin: $FRONTEND_ORIGIN`, otherwise 403. Every error uses the envelope `{"error": {"code", "message", "fields", "request_id"}}`.

## Listings API (implemented)

| Endpoint | Purpose |
|---|---|
| `GET /amenities` | The 12 amenities (slug, name, icon_key) |
| `GET /listings` | Search. Params: `location`, `check_in`+`check_out`, `guests`, `category`, `property_type`, `min_price_minor`, `max_price_minor`, repeated `amenity`, `page`, `page_size` (12, max 48). Newest first |
| `GET /listings/{id}` | Detail with ordered photos, amenities, host, rating |
| `GET /listings/{id}/reviews` | Paged reviews, newest first |
| `GET /listings/{id}/availability?from=&to=` | Occupied date ranges (default: the next 366 days) |
| `POST /listings/{id}/quote` | Itemised price plus a fingerprint; 409 if the nights are taken |

Rules worth knowing:
- A stay occupies `[check_in, check_out)`. A search or quote may start on another guest's checkout day.
- `check_in` and `check_out` must come together. Past check-in, zero nights, more than 365 nights, and too many guests are 422s that name the field.
- Several `amenity` values mean the listing needs all of them. Unknown amenities are 422.
- Price filters apply to the nightly base price, fees excluded, both ends inclusive.
- `rating` is null for a listing with no reviews. Archived and unknown listings are 404 on every route.
- Service fee is 10% of the nightly subtotal, rounded half up, in integer paise. A quote does not reserve the dates.

## Bookings API (implemented)

| Endpoint | Purpose |
|---|---|
| `POST /bookings` | Book. Needs a session and an `Idempotency-Key` header (8 to 80 characters). Body: `listing_id`, `check_in`, `check_out`, `guests`, `quote_fingerprint`. 201 when created, 200 for a retry |
| `GET /bookings/{id}` | Your own booking (confirmation page). Someone else's is a 404 |
| `GET /me/bookings?phase=upcoming\|past\|all` | Your trips, paged |

How a booking is decided. The checks read first so errors are specific, then one INSERT ... SELECT does the deciding. The database runs it as a single statement, so two requests for the same nights cannot both succeed:
1. Same key and same request as before: return that booking (200). Same key, different request: 409 `IDEMPOTENCY_CONFLICT`.
2. Unknown or archived listing: 404. Your own listing: 403 `OWN_LISTING`. Bad dates or too many guests: 422.
3. The quote fingerprint no longer matches the current price: 409 `PRICE_CHANGED`, with the fresh quote in `error.quote`.
4. Any night already taken: 409 `DATES_UNAVAILABLE`.
5. Otherwise the insert saves the booking, with price and listing details copied in. The insert itself re-checks that the listing is active, the price is unchanged, and no night is taken, so a host edit or a rival request in the gap cannot slip through.

Reuse one `Idempotency-Key` when retrying the same checkout (a lost response, a double click). Use a new key when the dates, guests, or accepted quote change. If the database stays busy past the 5 second timeout the answer is 503 `DATABASE_BUSY`, which is safe to retry with the same key. The client never chooses who the guest is, the price, or the status.

## Production

The server uses the same SQLite engine, with the file on a persistent disk (Render: a paid instance with a disk mounted at `/var/data`). A free instance has an ephemeral disk and would lose the data on every restart.

```
DATABASE_URL=sqlite:////var/data/app.db     # absolute path: four slashes (three would be a relative path and be wiped on redeploy)
FRONTEND_ORIGIN=<the Vercel URL>
COOKIE_SECURE=true
Build:  uv sync --frozen
Start:  uv run alembic upgrade head && uv run python -m app.seed && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- Migrations and the seed run in the start command, not the build, because the disk is not mounted during build. Both are safe to repeat on every boot.
- Run one instance (SQLite has one writer). Atomic booking statements, not instance count, prevent double bookings.
- Back up with `sqlite3 /var/data/app.db ".backup /var/data/backup.db"`, not a raw file copy (the database runs in WAL mode).

## Demo accounts

All five use the password `demo-password`. Every account can both book and host.

| Email | Owns listings |
|---|---|
| meera.kapoor@example.com | 8 (Goa, Jaipur) |
| arjun.nair@example.com | 8 (Manali, Kerala) |
| kavya.rao@example.com | 8 (Jaipur, Kerala) |
| rohan.verma@example.com | none |
| ananya.iyer@example.com | none |

## Data

Tables: `users`, `sessions`, `listings`, `listing_photos`, `amenities`, `listing_amenities`, `reviews`, `bookings`. The seed also adds 22 past and upcoming bookings, dated relative to the day you first seed. Money is integer paise. Allowed `property_type` and `category` values live in `app/vocab.py` and are enforced by CHECK constraints. The seed holds 24 listings in Goa, Himachal Pradesh, Rajasthan and Kerala, with 3 or 4 hand-picked Unsplash photos each (`listing_photos.source = 'unsplash'`). Four listings have no reviews on purpose, so they show "New".

Seed photos are hotlinked from `images.unsplash.com`. They are not uploaded anywhere and need no API key.

## Configuration

See `.env.example`: `DATABASE_URL`, `FRONTEND_ORIGIN`, `COOKIE_SECURE`.
