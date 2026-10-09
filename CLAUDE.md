# CLAUDE.md

Airbnb stays marketplace clone for an SDE fullstack assignment: Next.js (TypeScript) frontend, FastAPI backend, SQLite database. It is evaluated on functionality, how closely it matches Airbnb's UI, schema design, API design, code quality, modularity, and whether the author can explain every line. Write code a person can defend in an interview: plain, original, and commented only where the reason isn't obvious.

## Sources of truth (read before non-trivial work)

| File | Governs |
|---|---|
| `.claude/docs/Assignment Airbnb Clone.pdf` | Required scope and deliverables. Wins on *what* must exist |
| `.claude/PRD.md` | Requirement IDs (HOME-01, BOOK-02, …), acceptance criteria, product rules, routes |
| `.claude/system_architecture.md` | Schema, REST contract, booking invariants, auth, deployment |
| `frontend/DESIGN.md` | Visual tokens and component specs. Wins on *how it looks* |
| `AGENTS.md` | Phased execution plan and checklist |
| `frontend/AGENTS.md` | Generated Next.js notice. Do not remove it |

## Actual repository state (verified 2026-10-09)

**Treat the code on disk as the truth.** The docs were corrected on 2026-10-09 to say nothing in the backend is built; keep them that way.

- `backend/`: FastAPI app in `app/`, Alembic 0001-0004 (users, sessions, listings, photos, amenities, reviews, bookings, plus `users.age`), auth endpoints (signup/signin/signout/me, `POST /auth/check` for the email-first dialog, signup takes `age` 18+), a listings API (search, detail, reviews, availability, quote, amenities), a bookings API (`POST /bookings`, `GET /bookings/{id}`, `GET /me/bookings`), a seed (24 listings, 5 users, 78 Unsplash photos, 47 reviews, 22 bookings), `.env.example`, 91 passing tests (plus 7 opt-in Turso tests). The Turso testing database is migrated and seeded and passes 7 remote tests through app/turso.py (a pure-Python driver); the production database has not been written to. No favorites or host CRUD yet. The Git repo has no commits yet; everything is untracked.
- `frontend/`: Next 16.4.0, React 19.3.0, Tailwind 4. The UI foundation is set up but no feature screens exist yet; `/` is a placeholder. Only the initial commit exists, and the setup is uncommitted. What's in place:
  - shadcn (`radix-nova` style, Radix base, `iconLibrary: tabler`) with 27 primitives in `components/ui/`
  - Inter font
  - Airbnb design tokens in `app/globals.css`
  - a Zustand store
  - Sonner toaster and TooltipProvider mounted in `app/layout.tsx`
- No root Git repo. `frontend/` and `backend/` each have their own `.git`. Keep both histories; never reset or delete them.

Before you mark something done or cite a doc's status, check it on disk. When you finish a gate, update the AGENTS.md checklist so it matches reality.

## Commands

```bash
# frontend/
npm run dev          # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build

# backend/ (uv, Python >=3.14)
uv sync
cp .env.example .env                               # first time only
uv run alembic upgrade head                        # apply migrations
uv run python -m app.seed                          # demo data, safe to re-run
uv run alembic revision --autogenerate -m "msg"   # after changing models
uv run uvicorn app.main:app --reload --port 8000   # frontend/.env.local sets API_BASE_URL (this machine uses 8011)
uv run pytest                                      # local tests; the 7 Turso tests skip

# Turso (names the target every time, on purpose; uses the TURSO_* values in backend/.env)
uv run python scripts/on_turso.py testing alembic upgrade head
uv run python scripts/on_turso.py testing python -m app.seed
TURSO_TESTS=1 uv run pytest tests/test_turso.py    # needs the testing database migrated and seeded
# production: same commands with `production`, run once and deliberately
```

When you add migration, seed, or env commands, record them here and in the README.

## Stack and architecture rules

- **Next.js 16 is newer than your training data.** Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing framework code (routing, params, caching, route handlers, fonts, images). Don't "fix" code back to older APIs.
- FastAPI is the only authority for business data. Next.js holds no booking or listing logic, and nothing uses localStorage as primary persistence.
- The browser calls relative `/api/v1/...` URLs. A thin Next route handler `app/api/v1/[...path]/route.ts` forwards them to FastAPI using server-only `API_BASE_URL`. It forwards cookies, `Set-Cookie`, `Origin`, and `Idempotency-Key`, and adds no logic of its own. This keeps everything same-origin, so CORS is not needed.
- Backend shape: small modular monolith. Thin routers, Pydantic schemas, business rules in services, SQLAlchemy + Alembic. No repository layer and no microservices. Responses use public DTOs in snake_case, never raw ORM objects.
- Errors use one envelope: `{"error": {"code", "message", "fields", "request_id"}}`. 401 means no session, 403 is a forbidden action (cross-origin mutation, booking your own listing), 404 covers both missing and not-yours, 409 is a date/price/idempotency conflict, 422 is validation, 503 is DB busy.
- State has 4 homes:
  - **Search** lives in the URL, so it's shareable and survives refresh and back.
  - **Form drafts** stay in local component state.
  - **Persisted business data** lives in SQLite via FastAPI.
  - **Shared client UI/session state** lives in **Zustand**: `lib/stores/app-store.ts`, exposed through `useAppStore(selector)` from `components/providers/app-store-provider.tsx`. It holds the current user, the favorite-id set for synced hearts, and whether the auth dialog is open.

  Zustand rules:
  - Create the store per provider, never at module level. A module-level store would be shared between users during server rendering.
  - Always read through a selector.
  - Call `clearSession()` on signout.
  - Add slices to this one store instead of creating new stores.
  - Never put server data caches or secrets in it.
- Deployment: Vercel (frontend), Turso libSQL (production DB), Unsplash CDN (seed/default listing photos), Cloudinary (host-uploaded photos only). The FastAPI host is decided at deploy time; options are in architecture §11. Production data never lives on the backend's local disk.
- Images: `listing_photos.source` is `unsplash`, `cloudinary`, or `url`. Seed data is always `unsplash` — hand-picked `images.unsplash.com/photo-{id}` links, no API key, no account, not an upload. Cloudinary is reserved for a photo a real host uploads for their own listing: the host form's "Upload photos" asks `POST /host/uploads/sign` for a signed request (needs a session; the API secret stays in `backend/.env` as `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`) and the browser uploads straight to Cloudinary into `airbnb-clone/listings/<user id>`; the returned link is saved like a pasted one, with `source=cloudinary` and its public id. Pasting any https link still works. Don't seed through Cloudinary and don't call the Unsplash search API; both defeat the point (manual curation cost, and unnecessary account/key/rate-limit surface).

## Domain invariants (enforce on the server, test them)

- Money is integer **paise**, currency INR, formatted with an Indian locale.
- Dates are ISO `YYYY-MM-DD` calendar dates, and "today" means Asia/Kolkata. A stay occupies `[check_in, check_out)`, so a guest can check in on the previous guest's checkout day.
- Overlap: `existing.check_in < req.check_out AND existing.check_out > req.check_in`.
- Rejected: past check-in, zero nights or reversed dates, guests above capacity, archived listings, and booking your own listing. Check-in today is allowed.
- Pricing: `subtotal = nights × nightly`, `service = (subtotal*10 + 50)//100` (10%, rounded half-up), `total = subtotal + cleaning + service`. The frontend only formats numbers the API returns.
- A quote is not a hold. Booking recomputes the price and compares the quote fingerprint. A mismatch returns `PRICE_CHANGED` with a fresh quote.
- Booking is one atomic `INSERT INTO bookings ... SELECT ... WHERE (listing active AND price unchanged AND NOT EXISTS overlapping booking)`, after read-only checks that give specific errors. The database runs it as one statement, so no lock is needed and it works the same on local SQLite and Turso. A required `Idempotency-Key` (unique per guest) makes retries return the same booking. Bookings snapshot the price, title, location, and cover photo. Don't replace this with check-then-insert or with a lock held across round trips; Turso round trips take 0.4 s or more.
- "Delete listing" means archive (`archived_at`). Existing bookings stay readable.
- Ownership: host queries filter on `host_id = current user`. Never trust client-sent ids, totals, status, or ownership fields.
- Auth is deliberately simple (user decision, 2026-10-09):
  - Email/password, hashed with stdlib `hashlib.scrypt`. The auth dialog is one form that toggles between Log in (email, password) and Sign up (name, age, email, password) via a "Don't have an account? Sign up" link; no Google/Apple buttons. Signup stores `display_name` and `age`. Signed in, the header shows a Rausch circle with the first initial and a Log out menu; the user is restored from `GET /me` on load.
  - Signup and signin create a `sessions` row holding the SHA-256 of a random token. The raw token goes in an HttpOnly, SameSite=Lax `session` cookie that lasts 7 days with no renewal.
  - Every protected request looks the session up. Signout deletes the row.
  - FastAPI rejects non-GET requests whose `Origin` isn't the frontend (403).
  - No JWTs, refresh tokens, CSRF tokens, or throttling.
- One account type (user decision, 2026-10-09): every user can book and host. There is no role or `can_host` column, and no identity-switch endpoint. The guest/hosting toggle is UI only.

## UI rules (from DESIGN.md and AGENTS.md)

The assignment says the look and feel should be **exactly** Airbnb's. Follow DESIGN.md tokens, and where its prose disagrees with them, use these resolved values:

- Colors: canvas `#ffffff`, ink `#222222` (never pure black), muted `#6a6a6a`, hairline `#dddddd`, Rausch `#ff385c` (active `#e00b41`, disabled `#ffd1da`), error `#c13515`. Rausch is used sparingly. Stars and rating numbers are ink, never gold.
- Font: Inter stands in for Airbnb Cereal. Weights stay modest: homepage h1 28/700, detail h1 22/500, section heads 21/700, body 14–16/400. The one loud moment is the 64/700 rating display.
- Shapes: standard buttons 8px radius and 48px tall. Cards and photos 14px. Search bar is a full pill, 64px tall, with a 48px Rausch search orb. Text inputs are 56px, 8px radius, and on focus the border goes 2px ink with no glow.
- One shadow tier only: `rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px, rgba(0,0,0,.1) 0 4px 8px`. Use it on hovered cards, the search bar, dropdowns, the reservation card, and badges. Modal scrim is black at 50%.
- Spacing tokens: 2/4/8/12/16/24/32/48/64. Card gap 16px, major sections 64px.
- Breakpoints: below 744px, one column, a search sheet, and a sticky bottom reservation bar. 744–1127px, two columns. From 1128px, four columns. Content width is about 1280px on home, at most 1440px on search, and about 1080px on detail.
- **Light and dark themes** (user decision, 2026-10-11; Airbnb itself has no dark mode): `next-themes` puts `.dark` on `<html>` and `app/globals.css` swaps the named colour variables (`ink`, `hairline`, `surface-*`, `field`, `error`) plus shadcn's semantic ones. Use those token classes, never hard-coded greys, and `text-background` (not `text-white`) on an `ink` fill. The toggle (Light/Dark/System) lives in the footer. Gradients are allowed in exactly 4 roles. Use the tokens in DESIGN.md "Gradients & Illustration":
  - the auth "Continue" button (`#e61e4d → #e31c5f → #d70466` to the right, 12px radius, 48px tall, 16px semibold)
  - the neutral grey photo skeleton and broken-image fallback
  - avatars for users with no photo (3 gradients, picked by hashing the user id)
  - Experiences/Services "Coming soon" tiles

  Never use gradients on chrome, cards, standard buttons or backgrounds. No generic dashboard or marketing-hero look.
- **Icons** (DESIGN.md "Iconography"):
  - UI icons come from Tabler line icons only: monochrome, `currentColor`, 1.5–2px stroke.
  - The All/Homes/Experiences/Services tabs, the Bélo logo, and the favicon are the **real assets downloaded from airbnb.co.in's own CDN** (decided 2026-10-10 — this is a literal clone assignment), committed locally in `public/icons/` and `app/favicon.ico`. Not substitutes.
  - Unsaved heart: white outline on a `rgba(0,0,0,.15)` circle. Saved heart: solid Rausch.
  - Stars are ink "★", never gold.
  - Amenity icons come from `amenities.icon_key` through one lookup table.
  - Icon-only buttons need an `aria-label` and a hit area of at least 32px.
- Show "Guest favourite" and "Superhost" only when the API says so: the rules live in `backend/app/services/ratings.py` (Guest favourite: rating 4.8+ with 3+ reviews, per listing; Superhost: 4.8+ across 10+ reviews and 3+ completed stays, per host over all their listings). Airbnb's response-rate and cancellation conditions are not checked because there is no messaging or cancellation yet. Rating bars use `rating_breakdown` from the API. There are no per-category ratings (cleanliness etc.) because reviews only carry one overall score. The seed makes one host (Meera) top-rated so both badges are demonstrable and the other hosts visibly don't qualify.
- Text inputs use floating labels: a 12px muted label inside the top of a 56px field.
- **Styling is Tailwind only.** `app/globals.css` holds only imports and design tokens. No CSS modules, custom selectors, or inline styles.
  - Use the token classes it defines:
    - colors: `bg-rausch`, `text-ink`, `border-hairline`, `bg-surface-soft`, `text-error`, …
    - type: `text-display-xl`, `text-display-lg`, `text-title-md`, `text-body-sm`, `text-badge`, …
    - radius: `rounded-lg` = 8px for controls, `rounded-xl` = 14px for cards, photos and dialogs, `rounded-full`
    - elevation: `shadow-float`, the single shadow tier
    - widths: `max-w-home`, `max-w-search`, `max-w-detail`
    - gradients: `bg-(image:--gradient-…)`
  - Breakpoints are redefined: `md:` means tablet (744px), `lg:` desktop (1128px), `xl:` wide (1440px).
  - shadcn semantic tokens are already mapped to the Airbnb palette: `primary` = Rausch, `muted-foreground` = #6a6a6a, `border` = hairline, `destructive` = error.
- **Every UI element is a shadcn component.** Check `components/ui/` first.
  - If something is missing, add it with `npx shadcn@latest add <name>` and don't hand-roll it.
  - Read `npx shadcn@latest docs <name>` before using a component.
  - Compose the primitives into feature components under `components/` (`layout`, `search`, `listings`, `booking`, `hosting`). Pages coordinate data and don't restyle primitives.
  - Follow shadcn's rules: `FieldGroup`/`Field` for forms, `gap-*` and never `space-y-*`, `size-*`, `cn()`, `Skeleton` for loading, `Empty` for empty states, `toast()` from `sonner`, and a title on every Dialog/Sheet. Icons inside buttons use `data-icon` instead of size classes.
- Button variants:
  - `default`: Rausch, with active and disabled states
  - `outline`: 1px ink outline (Airbnb's secondary button)
  - `auth`: the gradient Continue button
  - `link`
  - Use `size="lg"` for 48px CTAs.
- Every data view handles loading (neutral skeleton), empty, error with retry, and success. Forms show field-level errors and keep the input. Pending buttons block double-submits. Toasts add to inline feedback and never replace it.
- Accessibility: labelled controls, visible focus, dialogs that trap focus, close on Esc, and restore focus, a calendar usable by keyboard, and never color alone for errors or unavailable dates. Images have alt text and a local fallback.
- Experiences/Services tabs, messaging, identity verification, and live maps show a clear "Coming soon". No dead links. Checkout says plainly that no payment is charged and never asks for card details.
- Don't invent ratings or badges. A listing with no reviews shows "New".

## Scope

**Must-have (P0):** explore grid, search (location/dates/guests), category and filters (price range, property type, amenities, all of which must match), pagination (12 per page), listing detail (gallery modal, amenities, host, reviews, availability calendar, price breakdown), validated booking, mock checkout and confirmation, My Trips (past/upcoming), host create/edit/archive, host dashboard and reservations, favorites, toasts, seed data (24 listings, 3 hosts, 2 guests, reviews, past and future bookings), a README (setup, stack, architecture, schema, API, assumptions), a public repo with `frontend/` and `backend/`, and a hosted link.

**Routes:** `/`, `/search`, `/rooms/[id]`, `/book/[listingId]`, `/bookings/[id]/confirmation`, `/trips`, `/wishlists`, `/hosting`, `/hosting/listings/new`, `/hosting/listings/[id]/edit`, `/hosting/reservations`, `/users/profile` (edit display name via `PATCH /me`). `/trips` (upcoming/past from `GET /me/bookings`, always fetched fresh), `/wishlists` (+ `GET /me/favorites`, `PUT/DELETE /me/favorites/{id}`, `GET /me/favorites/ids`; hearts everywhere share one store set, optimistic with rollback; migration 0005, tests in `tests/test_favorites_api.py`), `/book/[listingId]` (review + explicit confirm, one `Idempotency-Key` per quote so retries never double-book, `PRICE_CHANGED` shows the new total) and `/bookings/[id]/confirmation` are built. Trips, wishlists and hosting are sections of one profile page, `/users/profile?tab=about|trips|wishlists|hosting` (hosting also `&view=reservations`), with a left rail like Airbnb's and pills on a phone; `/trips`, `/wishlists`, `/hosting` and `/hosting/reservations` only redirect there (`lib/profile-links.ts` builds the URLs). The listing create/edit forms keep their own routes. The seed now has 40 listings (10 per region) so each landing shelf scrolls sideways. The host side is built: `/hosting` (dashboard with archive confirmation), `/hosting/listings/new`, `/hosting/listings/[id]/edit` (one form, URL photo entry), `/hosting/reservations` (guest names only, never emails), and the header switch ("Switch to hosting" / "Switch to travelling", a view change only). API: `GET/POST /host/listings`, `GET/PATCH/DELETE /host/listings/{id}`, `GET /host/bookings`; every query filters `host_id = current user` and someone else's listing answers 404; PATCH merges then re-validates the whole record in one transaction; archived listings can't be edited (409). Tests: `tests/test_host_api.py`. A mobile search sheet replaces the floating panels below 744px. `/search` is built: URL-driven results (12 per page) from `GET /listings` via a Server Component, a Filters dialog (type, category, price, amenities) plus amenity chips, numbered pagination, and the header shows the search summary in compact form. The results map is built: `GET /listings/map` (every match with coordinates, same filters as search) feeds a Leaflet + OpenStreetMap map with price bubbles beside the list (`components/search/results-map.tsx`, `results-layout.tsx`). Reviews can be written: `POST /listings/{id}/reviews` (rating 1-5, text 10-2000 chars) is allowed only after a stay at that home has ended and only once per home (403 `NOT_ELIGIBLE`, 409 `ALREADY_REVIEWED`); past trips show "Leave a review" (`components/trips/review-button.tsx`) and `GET /me/bookings` carries `reviewed`.

**Deferred until P0 is done:** an upload UI (entering photo URLs is enough), OAuth, email verification, password reset, cancellations, real payments.

## Working rules

- Build P0 as vertical slices in the AGENTS.md phase order. When time is short, cut extras, never required flows.
- Original work only. Don't copy any existing Airbnb clone repository; plagiarism means disqualification.
- When you add a dependency, give a one-line reason.
- Tests use temporary SQLite files, with separate connections for contention tests. Remote checks run against a separate Turso test database, never demo data.
- Never commit secrets, `.env`, database files, `.venv`, `node_modules`, or `.next`.
- Don't mark a requirement done based on mocked frontend data or unchecked screenshots. Verify it end to end, then update the AGENTS.md checklist.
- If the user changes a decision, update the PRD, the architecture doc, AGENTS.md, and this file together.
