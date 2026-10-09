# Airbnb Clone - System Architecture

Status (2026-10-10): the backend has the app shell, auth, migrations 0001-0004, a seed, the listings API, and the bookings API (create with idempotency, read, trips), tested on local SQLite and on the Turso testing database (migrations, seed, and 7 remote tests including two-client races). The production Turso database has not been written to yet. Favorites and host CRUD are still plan only.
Prepared: 2026-10-08.
Related: [PRD](PRD.md), [execution plan](../AGENTS.md), [design guide](../frontend/DESIGN.md), [assignment](docs/Assignment%20Airbnb%20Clone.pdf).

## 1. Constraints and decisions

| Area | Decision | Reason |
|---|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind 4, shadcn (radix-nova) on Radix, Tabler icons, Inter, Zustand | Installed; matches DESIGN.md |
| Backend | FastAPI with Pydantic request/response models | Allowed by assignment and already declared |
| Persistence | Local SQLite; production Turso hosted libSQL, SQLAlchemy/Alembic with verified driver | SQLite fork with durable remote storage; verify compatibility |
| API | JSON REST under /api/v1 with generated FastAPI OpenAPI | Small, inspectable contract |
| Authentication | Email/password, one opaque session token in an HttpOnly cookie, hashed in a sessions table | User chose simple auth on 2026-10-09; a DB lookup per request makes signout immediate |
| Payments | Atomic mocked checkout; no payment provider | Assignment explicitly permits mock payment |
| Media | Unsplash CDN for seed/default listing photos (hand-picked URLs, no API key); Cloudinary only for photos a real host uploads | Decided 2026-10-09: avoids manually curating a Cloudinary library for demo data, and keeps Cloudinary's free quota for genuine uploads |
| Search | SQL filters with offset pagination | Sufficient for assignment inventory |
| Deployment | Vercel frontend; FastAPI host confirmed at deployment; Turso database | Backend storage is independent of host lifecycle |
| Testing | pytest/httpx plus focused browser journey tests | Verify actual business invariants |

Do not upgrade the existing frontend simply to match remembered APIs. Read local installed framework documentation first. Python currently targets >=3.14; verify selected dependencies and deployment runtime before locking additions. Provider documentation was researched on 2026-10-08; deployment and remote-driver compatibility have not yet been tested.

## 2. Runtime topology

~~~mermaid
flowchart LR
    Browser[Browser: Next.js UI] --> Next[Next.js on Vercel]
    Next -->|Server reads and /api relay| API[FastAPI /api/v1 - host TBD]
    API --> Services[Listing, booking, identity services]
    Services --> DB[(Turso hosted libSQL)]
    Browser --> Unsplash[Unsplash CDN - seed photos]
    Browser --> Assets[Cloudinary CDN - host uploads]
~~~

Use one browser-visible origin. A thin Next.js relay under /api/v1 forwards allowed methods/paths to FastAPI using server-only API_BASE_URL. Forward body, content type, cookies, Origin, Idempotency-Key, status, error body, and every Set-Cookie header. The relay has no business rules and is not an arbitrary URL proxy.

Server Components may call FastAPI directly using the same configured origin and the current request's session cookie where required. Browser API calls always use relative /api/v1 URLs. Disable shared caching for identity-specific data and availability/quotes. Avoid static-build dependencies on a running backend by deliberately configuring data-backed routes for runtime fetching.

FastAPI can run on localhost:8000 and Next.js on localhost:3000 in development. Because browser calls are same-origin through the relay, permissive CORS is unnecessary. Reject untrusted origins for mutations at the public boundary. Keep production API reachability restricted where hosting permits.

## 3. Proposed source organization

~~~text
AGENTS.md
README.md
.claude/
  PRD.md
  system_architecture.md
  docs/Assignment Airbnb Clone.pdf
frontend/               # [exists] = on disk today; everything else is planned
  DESIGN.md             # [exists]
  components.json       # [exists] shadcn config: radix-nova, Tabler icons
  app/
    layout.tsx          # [exists] Inter, AppStoreProvider, TooltipProvider, Toaster
    globals.css         # [exists] Tailwind imports + Airbnb tokens only
    page.tsx            # [exists] placeholder Empty state until HOME-01
    search/page.tsx
    rooms/[id]/page.tsx
    book/[listingId]/page.tsx
    bookings/[id]/confirmation/page.tsx
    trips/page.tsx
    wishlists/page.tsx
    hosting/page.tsx
    hosting/listings/new/page.tsx
    hosting/listings/[id]/edit/page.tsx
    hosting/reservations/page.tsx
    api/v1/[...path]/route.ts
  components/
    ui/                 # [exists] 27 shadcn primitives (button, dialog, calendar, field, ...)
    providers/
      app-store-provider.tsx  # [exists] per-provider Zustand store + useAppStore(selector)
    layout/
    search/
    listings/
    booking/
    hosting/
  lib/
    utils.ts            # [exists] cn()
    stores/app-store.ts # [exists] user, favoriteIds, authDialogOpen, clearSession()
    api/                # Typed transport, responses, error mapping
    format.ts
    dates.ts
  public/
    icons/              # Real airbnb.co.in CDN assets: globe/house/balloon/bell tab icons
    images/             # Photo fallback, static map
  tests/                # Focused browser tests
backend/                # [exists] only main.py (greeting), pyproject.toml, uv.lock, empty README.md
  app/
    main.py
    config.py
    db.py
    models/
    schemas/
    api/                # Routers and current-user dependency
    services/           # Auth, pricing, booking, listings, search
    seed.py
  migrations/
  tests/
  pyproject.toml
  uv.lock
~~~

Routes stay thin; business rules live in services. There is no generic repository layer.

## 4. Data model

This table is the schema definition until the models and first Alembic migration exist. All identifiers are UUID strings. Audit/session timestamps use UTC Unix seconds. Stay dates use validated ISO YYYY-MM-DD values. Enable foreign keys per local connection and verify remote libSQL separately.

| Entity | Fields and constraints |
|---|---|
| users | id PK; lowercased email UNIQUE; password_hash; display_name; avatar_url nullable; created_at. No role column: every user can book and host |
| sessions | id PK; user_id FK users; token_hash UNIQUE (SHA-256 of the cookie token); expires_at; created_at. Signout deletes the row |
| listings | id PK; host_id FK users; title; description; city; region; country; location_label; latitude/longitude nullable; property_type; category; max_guests positive integer; bedrooms/beds nonnegative integers; bathrooms nonnegative number; nightly_price_minor positive integer; cleaning_fee_minor nonnegative integer; currency fixed INR; archived_at nullable; created_at; updated_at |
| listing_photos | id PK; listing_id FK listings; source enum(unsplash\|cloudinary\|url) default unsplash; cloudinary_public_id nullable (set only when source=cloudinary); url; alt_text; position nonnegative; UNIQUE(listing_id, position) |
| amenities | id PK; slug UNIQUE; name; icon_key |
| listing_amenities | listing_id FK listings; amenity_id FK amenities; composite PK |
| bookings | id PK; listing_id FK listings; guest_id FK users; check_in; check_out; guests positive; status confirmed; nights positive; nightly_price_minor; subtotal_minor; cleaning_fee_minor; service_fee_minor; total_minor; currency; listing_title_snapshot; location_snapshot; cover_photo_snapshot; idempotency_key; request_fingerprint; created_at; UNIQUE(guest_id, idempotency_key); CHECK(check_out > check_in) |
| reviews | id PK; listing_id FK listings; author_id FK users; rating integer CHECK 1..5; body; created_at; UNIQUE(listing_id, author_id). Seeded/read-only for MVP |
| favorites | user_id FK users; listing_id FK listings; created_at; composite PK(user_id, listing_id) |

Price fields on bookings are immutable nonnegative integers. CHECK total = subtotal + cleaning_fee + service_fee and subtotal = nights * nightly_price. Enforce cross-row rules (ownership, self-booking, capacity, availability) in services.

Fixed vocabularies live in backend/app/vocab.py and are enforced twice, by CHECK constraints in the database and by API validation. property_type: apartment, house, villa, cottage, cabin, guesthouse, farmhouse, houseboat. category: beachfront, pools, cabins, amazing_views, countryside, lakefront, design, mansions, tiny_homes, trending. amenities.icon_key is a key such as wifi, kitchen, pool, paw that the frontend maps to a Tabler icon.

Photos/amenity links can cascade on an eventual hard deletion, but application DELETE only archives listings. Bookings and their guest/listing references must not cascade away. Users are not deletable in MVP. Archived listings retain photos and relationships; favorites collection excludes them.

Useful indexes:
- listings(archived_at, created_at, id), listings(host_id, archived_at), listings(city), listings(property_type).
- bookings(listing_id, status, check_in, check_out) for overlap checks.
- bookings(guest_id, check_in, id) for trips.
- listing_amenities(amenity_id, listing_id), reviews(listing_id), sessions(user_id).
- Existing composite PKs provide photo ordering and favorite uniqueness indexes.

Location substring search over city/region/country is acceptable at seed scale; do not claim ordinary indexes accelerate arbitrary leading-wildcard search. Load photos/amenities/review aggregates in bounded queries to avoid one query per card.

~~~mermaid
erDiagram
    USERS ||--o{ LISTINGS : hosts
    USERS ||--o{ BOOKINGS : reserves
    USERS ||--o{ SESSIONS : signs_in
    USERS ||--o{ FAVORITES : saves
    USERS ||--o{ REVIEWS : authors
    LISTINGS ||--o{ BOOKINGS : receives
    LISTINGS ||--|{ LISTING_PHOTOS : displays
    LISTINGS ||--o{ LISTING_AMENITIES : offers
    AMENITIES ||--o{ LISTING_AMENITIES : describes
    LISTINGS ||--o{ REVIEWS : receives
    LISTINGS ||--o{ FAVORITES : appears_in
~~~

## 5. Date, availability, pricing, and booking invariants

### Calendar rules

Use Python date values at validation boundaries. API dates contain no timezone. Demo today uses Asia/Kolkata consistently on frontend/backend. Timestamps remain UTC.

A booking occupies [check_in, check_out). Overlap exists when:
~~~text
existing.check_in < requested.check_out
AND existing.check_out > requested.check_in
~~~

Check-in today is allowed. Reject past check-in, missing half of a date range, equal/reversed dates, non-integer guests, capacity overflow, archived listings, and self-booking.

Availability API returns occupied intervals, not guest identity. The calendar may allow an occupied interval's first day as checkout for a preceding stay; validate whole ranges rather than naively disabling every boundary for both endpoints. Adjacent stays are valid.

### Price policy

All arithmetic uses integer minor units:
~~~text
nights = check_out - check_in
subtotal_minor = nights * nightly_price_minor
cleaning_fee_minor = listing.cleaning_fee_minor
service_fee_minor = (subtotal_minor * 10 + 50) // 100
total_minor = subtotal_minor + cleaning_fee_minor + service_fee_minor
~~~

This implements the project's 10% service fee with half-up rounding. Currency is INR. Return every line item and nights from the quote API; frontend only formats it.

Quote response includes a deterministic quote fingerprint over listing ID, dates, guests, rate, fees, currency, and pricing policy version. It is a comparison token, not authorization or a hold. Confirmation recomputes and compares it. If different, return PRICE_CHANGED with a fresh quote for explicit review.

### Reservation

The decision is one SQL statement, not a transaction held open across several steps:

1. Validate the request shape and resolve the active session.
2. Look up (guest_id, idempotency_key). The same canonical request fingerprint returns the existing booking (200). A different request with the same key returns 409 IDEMPOTENCY_CONFLICT.
3. Read the listing and run the read-only checks, so errors are specific: 404 for an unknown or archived listing, 403 for your own listing, 422 for bad dates or guests, and 409 PRICE_CHANGED (with the fresh quote) when the quote fingerprint no longer matches.
4. Run one `INSERT INTO bookings ... SELECT ... FROM listings WHERE id = ? AND archived_at IS NULL AND nightly_price_minor = <quoted> AND cleaning_fee_minor = <quoted> AND NOT EXISTS (confirmed booking overlapping the stay)`. The database runs a single statement atomically, so two requests for the same nights cannot both insert, however they interleave. The same statement stops a host from archiving or re-pricing the listing between step 3 and the insert. The title, location and cover photo snapshots are read inside the statement.
5. Commit. One row inserted: return 201 with the booking. Zero rows: find out why and answer specifically. A twin request created it a moment ago: replay (200). The listing was archived: 404. The price moved: 409 PRICE_CHANGED with the fresh quote. Otherwise 409 DATES_UNAVAILABLE. A UNIQUE(guest_id, idempotency_key) violation means an identical request got in first, so return that booking.

Why not hold a lock (BEGIN IMMEDIATE) across the checks and the insert? That was the first design. It works, locally and on Turso (probed 2026-10-10), but Turso is reached over HTTPS and every statement is a round trip (0.4 to 0.6 s from the dev laptop). A lock held across about 7 round trips blocks every other writer for seconds. The single statement needs two round trips on Turso, no lock handling, and the same code on local SQLite. Evidence: the same race tests pass on local SQLite and on the Turso testing database, and deleting the NOT EXISTS clause makes both fail (on Turso, two overlapping bookings were saved).

Errors can carry extra keys (PRICE_CHANGED includes the fresh `quote`). A retry is answered from the stored booking and is not re-validated against today, so it still works after the dates pass.

Set a bounded busy timeout (5 seconds locally) and return a retryable 503 DATABASE_BUSY when contention exceeds it. A Turso request that fails on the network is the same 503. Do not silently retry forever.

Host edits and archiving are ordinary writes. The booking statement re-checks active status and price itself, so a host change cannot slip past a booking in progress.

A quote does not reserve inventory. Retain an idempotency key for retries of an identical checkout intent, including an unknown network outcome; generate a new key after dates/guests/accepted quote change. Never store session tokens in browser storage.

## 6. REST API contract

JSON responses use snake_case. Validate inputs through Pydantic, serialize public DTOs rather than raw ORM models, and use ISO date strings and integer money fields.

| Method/path under /api/v1 | Access | Purpose |
|---|---|---|
| GET /health | Public | Process/database readiness without sensitive configuration |
| POST /auth/signup | Public | Create account and session; set session cookie; return user |
| POST /auth/signin | Public | Check password; create session; set session cookie; return user |
| POST /auth/signout | Public | Delete current session if any; clear cookie |
| GET /me | Session | Current user (id, email, display_name, avatar_url) |
| GET /amenities | Public | Filter/form amenity vocabulary |
| GET /listings | Public | Active filtered listing summaries and pagination |
| GET /listings/{id} | Public | Active detail, ordered photos, host summary, review summary |
| GET /listings/{id}/availability | Public | Confirmed occupied intervals for bounded from/to window |
| GET /listings/{id}/reviews | Public | Paginated read-only reviews |
| POST /listings/{id}/quote | Public | Validate dates/guests, return current pricing and fingerprint. 422 for invalid dates or guests, 409 DATES_UNAVAILABLE if the nights are taken |
| POST /bookings | Session | Atomic mock reservation; Idempotency-Key header required |
| GET /bookings/{id} | Booking guest | Private booking/confirmation snapshot |
| GET /me/bookings | Session | Paginated trips. `phase` = upcoming (checkout still ahead, soonest first), past (most recent first) or all |
| GET /me/favorites | Session | Paginated saved active listing summaries |
| PUT /me/favorites/{listing_id} | Session | Idempotently save an active listing |
| DELETE /me/favorites/{listing_id} | Session | Idempotently remove favorite |
| GET /host/listings | Session | Caller's own listings, including archived via explicit filter |
| GET /host/listings/{id} | Owner | Editable listing data, including archived read access |
| POST /host/listings | Session | Create listing; server sets host_id to the caller |
| PATCH /host/listings/{id} | Owner | Validate and atomically update listing/photos/amenities |
| DELETE /host/listings/{id} | Owner | Archive; repeated owner deletion succeeds harmlessly |
| GET /host/bookings | Session | Paginated bookings on the caller's listings; optional listing_id |

"Owner" means a signed-in user whose id equals the listing's host_id. Any user becomes a host by creating a listing; there is no separate host role.

Listing query contract:
- location, check_in/check_out together, guests (default 1).
- category and property_type from fixed vocabularies.
- min_price_minor and max_price_minor inclusive, min <= max.
- repeated amenity parameters, matching all requested amenities.
- page >= 1; page_size default 12, maximum 48.
- default stable order created_at DESC, id DESC; no requirement for extra sorting controls.
- response: items, page, page_size, total, total_pages; beyond last page returns empty items.
- photo_url, title, city/location, nightly_price_minor, currency, rating nullable, review_count are summary fields.
- Availability filter uses NOT EXISTS overlapping confirmed booking; apply before pagination and count.
- Public search responses omit per-user favorite state; the UI merges an identity-scoped favorites query.
- Cap location length and availability window (maximum 366 days) and whitelist vocabularies.

Quote input: check_in, check_out, guests.
Booking input: listing_id, check_in, check_out, guests, quote_fingerprint.
Never accept client guest_id, host_id, total, status, or ownership fields as authoritative.

Host validation: trimmed nonempty title (maximum 120), description (maximum 5000), required city/country/location label, positive capacity/rate, valid category/type/amenities, at least one and at most 20 photos with unique positions. PATCH revalidates the resulting complete record and replaces supplied photo/amenity arrays atomically. User photo URLs must be HTTPS; trusted seed paths may be relative. Do not server-fetch arbitrary URLs.

Error envelope:
~~~json
{
  "error": {
    "code": "DATES_UNAVAILABLE",
    "message": "These dates were just booked. Choose another stay.",
    "fields": {},
    "request_id": "opaque-reference"
  }
}
~~~

Use 401 for no valid session, 403 for a forbidden action (cross-origin mutation, booking your own listing), 404 for missing/private resources not owned by the requester, 409 for availability/price/idempotency conflicts, 422 for validation, and 503 for temporary database contention. Normalize FastAPI validation errors into the envelope. GET /me returns 401 when anonymous; the frontend handles it as visitor state.

## 7. Identity and authorization

Simple session auth, chosen by the user on 2026-10-09:

1. Signup validates the email (lowercased, unique) and a password of 8 to 128 characters, then stores a salted `hashlib.scrypt` hash. scrypt is in the Python standard library, so this adds no dependency.
2. Signup and signin generate a random token with `secrets.token_urlsafe(32)`, insert a `sessions` row holding its SHA-256 hash with a seven-day expiry, and set it in a `session` cookie: HttpOnly, SameSite=Lax, Path=/, Secure in production, Max-Age seven days. Only the hash is stored, so a leaked database cannot be replayed as cookies.
3. Every protected request hashes the cookie, loads the unexpired session and its user, or returns 401. There is no JWT and no refresh token. The session simply ends after seven days.
4. Signout deletes the session row and clears the cookie.
5. CSRF: SameSite=Lax stops browsers sending the cookie on cross-site POSTs, and FastAPI also rejects any non-GET request whose `Origin` header is not the configured frontend origin (403). The relay forwards `Origin` for this check.

Wrong email and wrong password return the same 401 message. Throttling, password reset, email verification, and OAuth are out of scope.

Every user can book and host; there is no role column. The guest/hosting switch in the header is a UI mode and confers no authority. Host queries filter host_id=current_user.id. Booking detail filters guest_id=current_user.id; hosts obtain a limited reservation DTO through the host endpoint.

Use parameterized queries, request limits, strict response DTOs, trusted images, and safe text rendering. Do not log cookies/tokens/passwords or expose stack traces. Use fabricated seed data and clearly document any seeded credentials. No public identity-switch endpoint exists.

## 8. Frontend state and component design

- Use Tailwind utility classes for all authored component styling. app/globals.css contains only imports and shared design tokens; no page selectors, CSS modules, or inline style objects.
- The shared Button auth variant implements the user's login Continue screenshot with a horizontal gradient and 12px corners. Gradient colors and radius are tokens in globals.css; the variant itself uses Tailwind utilities.
- Installed today: shadcn `radix-nova` style with Tabler as its icon library, and 27 primitives in components/ui (alert, alert-dialog, avatar, badge, button, calendar, card, carousel, checkbox, dialog, drawer, dropdown-menu, empty, field, input, label, pagination, popover, scroll-area, separator, sheet, skeleton, slider, sonner, spinner, textarea, toggle, toggle-group, tooltip). Add missing ones with `npx shadcn@latest add`; don't hand-roll them. app/layout.tsx mounts Inter, AppStoreProvider, TooltipProvider, and the Sonner Toaster. app/page.tsx is a placeholder.
- Compose those primitives into feature components: components/layout (header, footer), components/search, components/listings (cards, gallery), components/booking, components/hosting. Pages coordinate data and don't restyle primitives.
- Zustand holds shared client UI/session state only: lib/stores/app-store.ts, read through `useAppStore(selector)` from components/providers/app-store-provider.tsx. The store is created per provider, never at module level. It holds `user` (filled from GET /me), `favoriteIds` (filled from GET /me/favorites so every heart agrees), and `authDialogOpen`. `clearSession()` runs on signout. Server data caches do not go in it. URL search and local form drafts keep their own responsibilities.
- Server-render read-oriented pages where appropriate; small Client Components own interactive calendars, dialogs, filters, steppers, favorites, and host forms.
- Search query is URL state. Edits remain draft until Apply/Search; reset page on filter change; browser back restores the previous query.
- Keep the transport in lib/api, distinguish pending/empty/error states, abort stale search requests, and prevent slow older responses from replacing newer results.
- Use explicit typed DTOs aligned to OpenAPI. Do not import database shapes into components.
- Share SearchBar, ListingCard, Gallery, DateRangePicker, GuestSelector, PriceBreakdown, FavoriteButton, ListingForm, EmptyState, and ErrorState.
- After booking: refresh availability, trips, affected searches, and host reservation views when revisited. After listing mutation: refresh detail/search/host inventory. After favorite toggle: synchronize visible hearts and wishlist, rollback on failure.
- Signout calls `clearSession()` and refreshes private queries, so the next account sees no cached trips or favorites from the previous one.
- Booking totals always come from API quotes; frontend date math is presentation-only.
- Do not share-cache cookie-dependent fetches. Treat availability as fresh and revalidate at write time.
- Two image sources render through `next/image` with `remotePatterns` for both hosts: `images.unsplash.com` (seed/default photos, their own `w`/`q`/`auto=format` query params, no account) and `res.cloudinary.com` (host-uploaded photos only, via a custom loader with fixed responsive widths and automatic format/quality to avoid a second Vercel optimization pass). Keep a local SVG fallback for failed loads regardless of source.
- Images have explicit dimensions and meaningful alt text; defer below-fold images. `listing_photos.source` tells the frontend which loader to use. Host photo URL entry remains supported for any HTTPS URL, not only Cloudinary. If a host upload UI is added, authorize signed browser-to-Cloudinary uploads in FastAPI, keeping image bytes and secrets out of the frontend relay.
- Icons: `@tabler/icons-react` for all UI glyphs (tree-shaken per-icon imports). amenities.icon_key stores a whitelisted key mapped to a Tabler component in one frontend lookup table; unknown keys render a neutral fallback icon. Product-tab illustrations, the Bélo logo mark, and the favicon are real assets pulled directly from airbnb.co.in's own CDN and committed locally (decided 2026-10-10: the assignment calls for a literal visual replica).
- Gradient tokens from DESIGN.md live in globals.css as CSS variables and are applied through Tailwind utilities only in their documented roles (auth Continue, photo skeleton/fallback, avatar fallback, Coming-soon tiles).
- Follow DESIGN.md and the PRD's responsive/focus/error behavior. Do not invent ratings or badges for visual polish.

## 9. Seed and migration strategy

Use versioned Alembic migrations. Fresh setup runs migrations before seed; application startup must not reset tables. Seed has stable IDs and inserts only missing seed records, preserving evaluator changes on rerun.

Implemented seed (`uv run python -m app.seed`; data in app/seed_data.py): 24 listings across four regions (Goa, Himachal Pradesh, Rajasthan, Kerala), 3 demo users who own the listings, 2 demo users who own none, 12 amenities, 3 or 4 hand-picked Unsplash photos per listing (78 total) (real estate/interior shots chosen by hand, `images.unsplash.com/photo-{id}` URLs committed in the seed script, `listing_photos.source='unsplash'`), mixed types/categories/amenities, and 47 reviews (four listings have none, so they show "New"). Past and future bookings arrive with the bookings slice. All five are ordinary accounts that could both book and host. Dates are relative only on initial insertion; reruns preserve listing edits and booking dates. Document demo credentials in the README. Cloudinary is not touched by seeding; its first real use is a host uploading a photo for their own listing.

Keep the runtime database, WAL/SHM files, .venv, node_modules, .next, secrets, and temporary screenshots out of version control. A reset command must be explicit and limited to the chosen development database.

## 10. Test and verification plan

| Layer | Required coverage |
|---|---|
| Pricing/date unit tests | Nights, fee rounding, past/equal/reversed dates, date boundaries, invalid guests |
| API/database integration | Filters combined, all-amenity matching, pagination/count, persistence, owner boundaries, archive, favorites uniqueness |
| Booking contention | Two separate connections/requests start together for overlapping dates; exactly one succeeds and one conflicts; adjacent dates both succeed |
| Checkout retries | Same key/body returns same booking; different body conflicts; timeout followed by retry creates no duplicate |
| Snapshot behavior | Price/description changes and archive do not alter confirmed trip details |
| Session isolation | Anonymous requests to private routes get 401; one user cannot read or mutate another's listing, booking, or favorites; a user cannot book their own listing; signout invalidates the cookie; cross-origin mutations get 403 |
| Browser journeys | Search to booking/trips, host CRUD, favorites, invalid dates, conflict recovery, direct links |
| Visual/accessibility | Principal screens at 390/820/1280/1536px, keyboard dialogs/calendar, overflow, sticky controls, image failure |

Use temporary file-backed SQLite databases for local tests and a separate Turso test database for remote migration, transaction, and concurrency checks; never test against the demo database. Backend test requests must exercise the actual transaction service. Freeze/control the clock for past-date cases.

Existing frontend scripts: npm run lint and npm run build; npx tsc --noEmit also works. Planned verification also includes and focused browser test tooling once added. Backend uv run pytest becomes valid after test dependencies/configuration exist. Record results; do not imply these checks were run during planning.

## 11. Configuration and deployment

Confirmed: **Vercel frontend + Turso hosted libSQL (SQLite fork) + Cloudinary images**. Confirm the FastAPI host at deployment. Use remote libSQL, not Turso's newer rewrite engine, unless explicitly revisiting the database decision; match the Python driver accordingly. [Driver reference](https://docs.turso.tech/sdk/python/reference).

### Saved backend options

Published limits checked 2026-10-08; recheck at deployment. Cold-start timings are vendor guidance, not benchmarks or guarantees.

| Option | Free allowance / constraints | Deployment consideration |
|---|---|---|
| Vercel FastAPI | Hobby: 1M invocations/month, 4 CPU-hours, 360 GB-hours; 300s function duration; 4.5 MB payload limit | Python 3.14 supported; cold starts possible; shared Hobby quotas and personal/non-commercial use. [FastAPI](https://vercel.com/docs/frameworks/backend/fastapi), [quotas](https://vercel.com/docs/plans/hobby), [limits](https://vercel.com/docs/functions/limitations) |
| Render Free | 750 instance-hours/month/workspace; sleeps after 15 minutes; about one-minute wake-up | Ephemeral disk is fine with remote Turso; show useful waking/retry state. [Free tier](https://render.com/docs/free) |
| Koyeb Free | One 512 MB / 0.1 vCPU instance; sleeps after one hour; no persistent volume | Card required; verify signup charges/selected plan; total app cold start not guaranteed. [Instances](https://www.koyeb.com/docs/reference/instances), [billing](https://www.koyeb.com/docs/faqs/pricing) |
| Cloud Run | Request-based free allowance: 2M requests, 180K vCPU-seconds, 360K GiB-seconds/month | Container deployment, billing setup, variable cold starts; minimum warm instances incur costs. [Pricing](https://cloud.google.com/run/pricing) |
| Oracle Always Free | Eligible VM compute with persistent storage | More server maintenance; capacity and idle-instance reclamation risks. [Limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) |

Secondary options: PythonAnywhere ASGI remains beta ([docs](https://help.pythonanywhere.com/pages/ASGICommandLine/)); Railway grants $5 for up to 30 days, then $1/month ([docs](https://docs.railway.com/pricing/free-trial)); Fly.io offers a two-VM-hour/seven-day trial, then paid usage ([docs](https://docs.fly.io/about/free-trial)). New Hugging Face Docker Spaces require a paid account plan ([docs](https://huggingface.co/docs/hub/spaces-overview)).

### Selected service limits

- Turso Free: 5 GB total storage, 100 databases, 500M row reads and 10M row writes/month; one-day recovery. Quota exhaustion blocks access. [Pricing](https://turso.tech/pricing).
- Cloudinary Free: 25 shared credits across storage, bandwidth, and transformations; 1 credit = 1 GB storage or image bandwidth or 1,000 transformations. Bandwidth/transformations use a rolling 30-day window. Maximum image 10 MB; Admin API 500 requests/hour, not an Upload API cap. Reserved for host-uploaded photos only (seed/default photos use Unsplash CDN instead), so quota is spent only when a real host adds a photo. [Billing](https://cloudinary.com/documentation/billing_and_plans), [file limits](https://cloudinary.com/pricing/compare-plans), [API limits](https://cloudinary.com/documentation/admin_api).
- Unsplash: linking `images.unsplash.com/photo-{id}` URLs directly is not a rate-limited API call (no key, no Unsplash account), it's loading their CDN like any other image. No quota to track. Per Unsplash's guidelines, attribute photographers somewhere findable (e.g. a credits page); do not use the deprecated `source.unsplash.com` redirect endpoint.

### Configuration and delivery

- Backend settings (backend/.env.example): DATABASE_URL (a SQLite file locally, or a libsql:// address), TURSO_AUTH_TOKEN (only with a libsql:// URL, never inside the URL), FRONTEND_ORIGIN, COOKIE_SECURE. The local .env also holds TURSO_DATABASE_URL_TESTING, TURSO_TESTING_SECRET, TURSO_DATABASE_URL_PRODUCTION and TURSO_PRODUCTION_SECRET, which only scripts/on_turso.py reads. On the host, set DATABASE_URL and TURSO_AUTH_TOKEN to the production values.
- Turso driver: app/turso.py, a pure-Python DB-API driver over Turso's HTTPS API (Hrana /v2/pipeline), used by SQLAlchemy through its SQLite dialect. It exists because Turso's native packages cannot be installed here: `libsql-experimental` has no Windows wheels and nothing for Python 3.14, and `libsql` has no Windows wheel for 3.14. It copies sqlite3's transaction behaviour (a SELECT runs alone; the first INSERT/UPDATE/DELETE begins a transaction that stays open on the server until commit or rollback) and sends a statement with its BEGIN in one request. Pool size 5 plus 5 overflow.
- Verified 2026-10-10 on the testing database: Alembic migrations 0001-0004 (21 s), the seed (2.6 min, row counts equal the seed data, a second run changes nothing), and tests/test_turso.py (7 tests, 78 s). Latency is one round trip per statement, 0.4 to 0.6 s from the dev laptop to Mumbai, and 2.4 s for the first request. A host in the same region should be much faster, but that is not measured. Local timezone is Asia/Kolkata (needs the `tzdata` package on Windows) and currency is INR.
- Images: CLOUDINARY_CLOUD_NAME plus server-only CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET if API operations are needed. Public asset URLs may reach the browser; credentials must not.
- Frontend: server-only API_BASE_URL for the same-origin relay; preserve cookie, Origin, and Idempotency-Key headers.

1. Preserve existing Git histories and package one submission repository.
2. Verify clean setup, migrations, seed, builds, and booking invariants locally and on a separate Turso database.
3. Confirm backend host after checking runtime/driver compatibility, quotas, regions, cold starts, and signup requirements.
4. Configure Turso (required) and Cloudinary (required only once host photo upload exists; host URL entry works without it); run production migrations/seed deliberately, not per request or cold start.
5. Deploy Next.js on Vercel and FastAPI on the chosen host; verify relay sessions and direct Unsplash/Cloudinary image delivery.
6. Smoke-test booking conflicts, trips, host CRUD, favorites, and persistence across backend restart/redeploy; test Turso backup/restore.
7. Record public repository/demo URLs. Accounts, credentials, backend provider, and deadline remain delivery inputs.

The backend can use ephemeral storage because durable data lives in Turso; seed images live on Unsplash's CDN and host-uploaded images live in Cloudinary. Never treat a backend-local SQLite file as the production source of truth.

## 12. Deliberate tradeoffs

- Payments remain mocked. Auth is a simple session cookie (user request, 2026-10-09). JWTs, refresh rotation, throttling, OAuth, verification email, and recovery are left out.
- One account type: every user can book and host. Ownership checks replace a host role.
- Local SQLite and remote libSQL must both pass the booking invariants; backend instance count cannot substitute for atomic database transactions.
- Unsplash CDN hosts seed/default photos (hand-picked URLs, no account); Cloudinary is reserved for photos a real host uploads, so its free tier is spent only on genuine use. Host URL entry avoids a mandatory upload UI, while a local fallback keeps image failures usable.
- Read-only seeded reviews satisfy the required review section; review submission is deferred.
- Archive semantics preserve booking history and avoid cascading data loss.
- Static map and Coming soon secondary services preserve navigation without expanding required domain scope.
- Core completion is measured by PRD acceptance and AGENTS.md gates, not by the number of screens or installed packages.
