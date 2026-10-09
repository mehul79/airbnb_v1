# Project instructions and delivery plan

## Purpose and source of truth

Build a functional, visually faithful Airbnb stays marketplace for the fullstack assignment. This file is the execution plan for future work; it does not claim planned features already exist.

Read before implementation:
1. [Assignment](.claude/docs/Assignment%20Airbnb%20Clone.pdf): authoritative scope and deliverables (4 pages).
2. [PRD](.claude/PRD.md): requirement IDs, user journeys, acceptance criteria, and scope decisions.
3. [System architecture](.claude/system_architecture.md): data model, API, invariants, deployment, and verification.
4. [Frontend design guide](frontend/DESIGN.md): visual tokens and interaction patterns.
5. Any directory-specific AGENTS.md; preserve frontend/AGENTS.md and its generated Next.js guidance.

The assignment governs required functionality; DESIGN.md governs presentation. Planning choices below fill gaps and are not additional assignment requirements. If they conflict with a later user instruction, update all affected documents.

## Inspected baseline (re-verified 2026-10-09)

- No root Git repository exists. frontend/ and backend/ each contain a separate .git directory. Preserve their histories and existing changes.
- Frontend: Next.js 16.4.0, React 19.3.0, TypeScript, Tailwind 4. UI foundation only: shadcn radix-nova with 27 primitives in components/ui, Tabler icons, Inter, Airbnb tokens in app/globals.css, a Zustand store, Sonner. app/page.tsx is a placeholder. public/ is empty; no feature components, no lib/api, no relay route yet.
- Backend: Python >=3.14, uv.lock, FastAPI only; main.py prints a greeting. README.md is empty.
- Nothing else exists: no app, schema, tables, database, migrations, seed, tests, .env.example, or Turso/Cloudinary connection. No listing images exist anywhere yet (no seed script, no Unsplash URLs chosen).
- frontend/README.md is template documentation.
- Existing frontend and backend changes are user work. Do not reset, overwrite, or discard them.

## Implementation rules

- Keep Next.js + TypeScript in frontend/, Python + FastAPI in backend/, and SQLite as required.
- Deployment choices: Vercel frontend, Turso hosted libSQL (SQLite fork) database, Unsplash CDN for seed/default listing photos, Cloudinary for host-uploaded photos only. Confirm the FastAPI host at deployment; options are saved in .claude/system_architecture.md, section 11.
- Use local SQLite for development and a verified remote libSQL driver in production. Test migrations and atomic booking conflicts against Turso before delivery; no production database or images on ephemeral backend disk.
- Read applicable installed Next.js guides in frontend/node_modules/next/dist/docs/ before changing framework code. Installed APIs may differ from familiar versions.
- Use FastAPI as the sole business-data authority. Do not build a second booking backend in Next.js or use localStorage as primary persistence.
- Prefer a small modular monolith: API routers, validation schemas, services for business rules, and SQLite persistence. No microservices, queues, or real payment integration.
- Use existing UI primitives and Inter. Do not replace the design direction with a generic dashboard, oversized marketing hero. (A light/dark theme toggle was added at the user's request on 2026-10-11; see CLAUDE.md.) Gradients are limited to the roles in DESIGN.md "Gradients & Illustration": the auth Continue button, neutral photo skeleton/fallback, no-photo avatars, and Experiences/Services Coming-soon tiles. Never on chrome, cards, or standard buttons.
- Icons: Tabler line icons (single family, currentColor) for UI. The product-tab illustrations, Bélo logo, and favicon are the real assets pulled from airbnb.co.in's own CDN (decided 2026-10-10 — literal clone assignment), committed locally. Mapping lives in DESIGN.md "Iconography".
- Use the installed shadcn primitives first, including Card, Badge, Dialog, Button, Input, Field, Empty, and Separator. Compose them into shared feature components instead of rebuilding them in each page.
- Keep globals.css limited to Tailwind imports and shared color, font, typography, spacing, radius, and breakpoint tokens from DESIGN.md. All component styling, responsive rules, focus states, and motion preferences use Tailwind classes. No custom CSS selectors, CSS modules, or authored inline styles.
- Pages coordinate data and state; shared header/footer, listing cards, search controls, and dialogs live in components/. Zustand (set up 2026-10-09) holds shared client UI/session state only: lib/stores/app-store.ts via components/providers/app-store-provider.tsx (per-provider store, selector hooks).
- Frontend foundation set up 2026-10-09: shadcn radix-nova + Tabler icons (27 primitives in components/ui), Inter, Airbnb tokens in app/globals.css, light-only Sonner, Button `auth` variant and 48px `lg` size. lint, tsc --noEmit, and build pass.
- Keep search state in URLs, draft form state local, and persisted business state in SQLite.
- Enforce ownership, capacity, availability, and price calculation on the server.
- Currency uses integer minor units; dates use ISO calendar dates and checkout-exclusive intervals.
- Mock checkout must clearly say no payment is charged; never collect real card details.
- Auth is simple (user decision, 2026-10-09): email/password signup/signin, a scrypt password hash, and one opaque session token in an HttpOnly cookie, hashed in a sessions table, with a seven-day expiry. SameSite=Lax plus an Origin check on mutations. No JWTs, refresh tokens, or throttling. Seeded accounts are for demonstration; there is no identity-switch endpoint.
- One account type (user decision, 2026-10-09): every user can book and host. The guest/hosting switch is a UI mode. Ownership (listing.host_id = current user) is the only host check.
- Build original implementation; do not copy an existing Airbnb clone repository.
- Explain dependencies and non-obvious decisions. The assignment evaluates the author's understanding of the code.
- Keep source inputs intact. Mark requirements complete only after implementation and verification.

## Visual contract

Use frontend/DESIGN.md for full definitions. Resolve its minor narrative inconsistencies using explicit component tokens:
- White canvas #ffffff, ink #222222, muted #6a6a6a, Rausch #ff385c, active #e00b41, error #c13515.
- Inter is the documented substitute for unavailable licensed Cereal/Circular fonts.
- Buttons: 8px radius and 48px height; photos/cards: 14px; search pill: fully rounded, 64px high, 48px search orb.
- Use the documented single subtle shadow tier, hairline borders, and photography-led hierarchy.
- 28px/700 homepage heading, 22px/500 detail heading, 14-16px body; avoid applying heavy headings everywhere.
- Spacing tokens: 2/4/8/12/16/24/32/48/64px. Cards have 16px gutters; major sections use 64px.
- Mobile below 744px: one listing column, search sheet, bottom reservation bar.
- Tablet 744px to below 1128px: two columns; desktop from 1128px: four columns.
- Home content approximately 1280px, search at most 1440px, detail body approximately 1080px.
- Homes is functional. Experiences/Services can preserve the reference navigation with explicit Coming soon feedback, never empty navigation.
- Use accessible labels, keyboard dialogs/calendars, visible focus, image fallbacks, and loading/empty/error/success states.
- Design gaps are implementation decisions: use neutral skeletons, error text plus input border, restrained toasts, and a static location map. Verify rendered contrast; adjust accessible variants where required.

## Execution sequence and completion gates

The assignment estimates approximately 24 hours, not a guaranteed schedule. The allocation below totals 24 hours and includes this planning work. Preserve required functionality when time is tight; defer optional extras.

### Phase 0 - Requirements and repository baseline (1 hour)

- [x] Read all assignment pages and frontend/DESIGN.md.
- [x] Inspect existing frontend/backend and directory instructions.
- [x] Write AGENTS.md, .claude/PRD.md, and .claude/system_architecture.md.
- [ ] Establish the eventual single submission repository without deleting nested Git histories; use a separate consolidated checkout if appropriate.
- [ ] Record existing build/runtime baseline and confirm local dependency compatibility.
- Gate: all P0 requirements map to a planned route, API, and acceptance check.

### Phase 1 - Database, API shell, and usable seed (3 hours)

- [x] Replace the greeting backend with a FastAPI app, settings, health route, and structured errors.
- [x] Add SQLAlchemy, Alembic, and pytest/httpx; keep uv.lock reproducible.
- [x] Migration 0001: users, sessions.
- [x] Migration 0002: listings, listing_photos, amenities, listing_amenities, reviews, with CHECK constraints and indexes (tested).
- [x] Migration 0004: bookings, with CHECK constraints for dates, totals and statuses and a unique (guest, idempotency key).
- [ ] Migrate favorites with its slice.
- [ ] Add constraints, indexes, foreign keys, and short transactional writes for booking confirmation, host mutations, and favorites.
- [x] Turso driver, migrations, seed and booking guarantees verified against the TESTING database on 2026-10-10. Production has not been written to.
  - No native driver installs on Windows with Python 3.14, so `app/turso.py` is a pure-Python driver over Turso's HTTPS API. SQLAlchemy uses it unchanged. 8 local tests cover its transaction rules with a fake server.
  - Migrations 0001-0004 and the seed ran with `uv run python scripts/on_turso.py testing ...` (21 s and 2.6 min). Remote row counts equal the seed data, and a second seed run changed nothing.
  - `tests/test_turso.py` (opt-in with `TURSO_TESTS=1`, 7 tests, 78 s): foreign keys and CHECK constraints, types, search, retries, key conflicts, the price guard, two-client races, a host edit mid-booking, and the HTTP API end to end. Deleting the overlap guard made the remote race test fail with two overlapping bookings saved.
  - Probe numbers from the dev laptop: 2.4 s for the first request, 0.4 to 0.6 s after. This is why booking is one atomic INSERT ... SELECT and not a lock held across steps.
- [ ] Run migrations and the seed on the PRODUCTION Turso database, once and deliberately: `uv run python scripts/on_turso.py production alembic upgrade head`, then `... production python -m app.seed`.
- [x] Hand-pick Unsplash CDN photo URLs for seed listings (78 unique URLs, each checked to return 200 and looked at; no upload, no API key). Photographer names were not captured, so a credits page is not possible without the Unsplash API. The local image fallback is a frontend task.
- [x] Seed 24 listings in 4 regions, 5 users (3 own listings, 2 do not), 12 amenities, 78 photos, and 47 reviews on 20 listings (4 stay unreviewed so they show "New").
- [x] Seed 22 past and upcoming bookings across 11 listings, including two back-to-back stays on one listing.
- [x] Implement signup/signin/signout, the session cookie, GET /me, and the Origin check (10 tests pass, smoke-tested with curl). Ownership checks arrive with listings.
- [x] Add backend .env.example and migration commands (README, CLAUDE.md). Seed: `uv run python -m app.seed` (idempotent).
- Gate: clean database setup is repeatable; identities and seeded listings survive API restart.

### Phase 2 - Marketplace shell and search (4 hours)

- [x] Implement shared navigation (desktop), scroll-collapsing header (full nav+search → condensed single row), and presentational search pill, card, and horizontal listing-row components, using real icon/logo/favicon assets sourced from airbnb.co.in. Not yet browser-verified (user asked to hold off on testing as of 2026-10-10). Mobile nav collapse, footer, filters, and toast region remain.
- [x] Implement list/search API with location, dates, guests, category, property type, price, amenities, and stable pagination (GET /listings, tested; amenities need every match).
- [ ] Connect home/search to actual API results; preserve query state through refresh and browser history.
- [ ] Implement skeletons, no-results reset, errors/retry, image fallbacks, and favorites entry points.
- Gate: changing each filter changes matching persisted results; pagination works across at least two pages.

### Phase 3 - Listing detail and quote (3 hours)

- [ ] Add gallery and photo modal, title/location, description, amenities, host, reviews, and static map.
- [ ] Implement availability calendar, date and guest validation, desktop reservation rail, and mobile reservation bar.
- [x] Add server quote with nights, nightly subtotal, cleaning fee, service fee, and total; fee rounding tested. Stale-price handling (PRICE_CHANGED) arrives with POST /bookings.
- [x] API: unknown or archived listings return 404 on every public route; taken or invalid dates return 409 or 422. UI states are still to do.
- Gate: the gallery works; invalid dates cannot proceed; UI and API pricing agree.

### Phase 4 - Booking and trips (4 hours)

- [ ] Add checkout summary and explicit simulated confirmation action.
- [x] Implement atomic overlap checks and booking persistence: one INSERT ... SELECT ... WHERE NOT EXISTS (overlap), on local SQLite and on Turso.
- [x] Add booking idempotency and stale-price/conflict handling (PRICE_CHANGED returns the fresh quote); retry, changed-intent and late-retry behavior tested.
- [ ] Implement confirmation and My Trips, including past/upcoming presentation.
- [ ] Refresh availability, search, trips, and host reservations after mutations.
- [x] Test concurrent competing clients (two threads, two connections, six rounds), adjacent dates, twin requests with one key, a host edit or archive between the checks and the insert, and a busy database (503), locally. Deleting the overlap guard makes these fail.
- [x] Repeat the contention tests on the Turso testing database (7 remote tests). Rows were seen by separate processes (seed, tests, probes), so they persist outside any one backend run.
- Gate: two competing clients cannot book overlapping nights; successful booking appears in trips and blocks dates.

### Phase 5 - Host CRUD and reservations (3 hours)

- [ ] Build owned-listings dashboard and bookings view.
- [ ] Create/edit form: title, description, location, property type/category, capacity, nightly price, fees, photo URLs, and amenities.
- [ ] Implement create/edit/archive APIs with ownership enforcement and validation; verify private host reservations.
- [ ] Confirm deletion in UI; archive listings so existing bookings remain readable.
- [ ] Preserve accepted booking prices and stay snapshots across host edits and archive; integration-test it.
- Gate: host can create, edit, and remove their listing; another identity cannot mutate it or inspect private bookings.

### Phase 6 - Favorites and UX review (2 hours)

- [ ] Persist favorite toggles per identity and finish wishlists page.
- [ ] Verify toasts, disabled/pending actions, keyboard operation, focus restoration, and useful error text.
- [ ] Review home/detail/checkout/host screens at mobile, tablet, and desktop sizes.
- [ ] Make placeholder actions explicit and remove dead links/buttons.
- Gate: favorite state survives refresh; required interactions work at all target viewport sizes.

### Phase 7 - Verification, documentation, and delivery (4 hours)

- [ ] Run backend tests, frontend lint/type check/production build, and core browser journeys.
- [ ] Check a fresh setup from documented commands and a clean database.
- [ ] Replace template README with setup, stack, architecture, schema, API overview, assumptions, demo identities, and testing.
- [ ] Package one public-ready repository containing frontend/, backend/, and planning docs; omit secrets, databases, generated output, and environments.
- [ ] Deploy frontend on Vercel; confirm the FastAPI host using the saved options, connect Turso (and Cloudinary once host upload exists), then run migrations and seed safely.
- [ ] Smoke-test hosted booking, host CRUD, persistence across backend restart, and direct links.
- [ ] Record public repository and hosted application URLs for submission; actual deadline must come from the assignment sender.
- Gate: a reviewer can use both links, reproduce setup, and complete every P0 journey.

## Verification checklist

- Backend: date ordering/past dates, capacity, overlap containment/partial overlap, adjacent dates, two concurrent reservations, idempotent retry, stale prices, ownership, archive behavior, filter combinations, favorites uniqueness, and persisted data.
- Frontend: browse -> filter -> detail -> checkout -> confirmation -> trips; host create -> edit -> archive; signout/signin as another account -> authorization boundary; save -> refresh -> unsave.
- Design: compare with DESIGN.md at 390px, 820px, 1280px, and 1536px; check overflow, dialog scrolling, readable prices, photo proportions, and mobile reservation visibility.
- Planned commands: frontend npm run lint, npx tsc --noEmit, npm run build; backend uv run pytest. Add test setup before treating these as established passing checks.
- Local database tests must use temporary SQLite files, including separate connections for contention; run remote integration checks against a separate Turso test database, never demo data.
- Do not mark implementation complete based on mocked frontend responses or unchecked screenshots.

## Delivery and maintenance discipline

Update this checklist and related requirement IDs as work passes its gates. Record actual commands and results. Keep PRD about behavior, architecture about technical decisions, and this file about execution. Optional review creation, live maps, host file-upload UI, dark mode, and additional integrations remain deferred until P0 is complete.

Current status (2026-10-10, backend): auth, listings API, bookings API (one atomic INSERT ... SELECT decides each booking), the seed, and a pure-Python Turso driver. Alembic is at 0004. 91 local tests pass, plus 7 opt-in tests that pass against the Turso testing database, which is migrated and seeded. Production Turso has not been written to. Favorites and host CRUD are not built; the confirmation and My Trips screens are not built.

Current status (2026-10-10): frontend landing page (header, search bar, two listing rows) and the sign-in/sign-up dialog are built and visually verified (browser screenshots at 1440px and 390px) against the user's reference screenshots and a live airbnb.co.in fetch. All data on the page is hardcoded mock data (lib/mock-listings.ts) with hand-picked Unsplash photo URLs; GET /listings wiring, mobile search-sheet collapse, filters, and the account/hamburger dropdown menus remain. lint, tsc --noEmit, and build all pass.
