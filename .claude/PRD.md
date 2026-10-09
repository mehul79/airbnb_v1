# Airbnb Clone - Product Requirements Document

Status (2026-10-09): planning only. No backend app, schema, database, seed, or API exists yet. The frontend has its UI foundation (shadcn primitives, Airbnb tokens, Inter, a Zustand store) and a placeholder home page. No requirement below is complete.
Prepared: 2026-10-08.

## 1. Sources and objective

- [Assignment PDF](docs/Assignment%20Airbnb%20Clone.pdf), pages 1-4: scope, stack, evaluation, and submission.
- [Design guide](../frontend/DESIGN.md): Airbnb visual language and responsive interactions.
- [Execution plan](../AGENTS.md) and [architecture](system_architecture.md): implementation sequence and technical decisions.

Deliver a photo-forward Airbnb-style stays marketplace where guests discover properties and book available nights, and hosts manage persisted listings and see reservations. Success means working end-to-end workflows and recognizable Airbnb UI, supported by an understandable schema and API.

Assignment constraints: Next.js with TypeScript; Python using FastAPI or Django; SQLite; mocked payments are sufficient. FastAPI is already present. The assignment permits simplified authentication. The user chose simple email/password signup/signin with a session cookie backed by a database session (2026-10-09). No JWTs, refresh tokens, OAuth, or throttling. Listings and bookings must persist.

Selected deployment: Vercel for frontend, Turso hosted libSQL (SQLite fork) for persistent data, Unsplash CDN for seed/default listing photos, and Cloudinary for photos a real host uploads. FastAPI hosting remains undecided until deployment; see architecture section 11 for options. Local development uses SQLite; remote transaction and migration compatibility must be verified.

The PDF estimates approximately 24 hours. The submission deadline is external to the PDF and remains unknown.

## 2. Users and capabilities

| Actor | Capabilities |
|---|---|
| Visitor | Browse, search, filter, view listing/reviews/availability, and prepare a quote |
| Signed-in user | Visitor capabilities plus book stays, view own trips, manage favorites, create/manage own listings, and view reservations for them |

There is one kind of account. Every user is both a guest and a host (decided 2026-10-09). The header switches between the guest view and the hosting view (/hosting); that switch is a UI mode and changes no identity or permission. Ownership decides what a user can manage: a host is simply the user whose id is on the listing. Changing accounts requires signout/signin. Booking one's own listing is rejected as a project policy.

## 3. Scope and priority

P0 means required by the assignment. P1 means a chosen quality target or assignment bonus. P2 means deferred.

### Required product capabilities and acceptance criteria

| ID | Requirement and source | Acceptance criteria |
|---|---|---|
| HOME-01 | Explore cards (PDF pg. 1) | API-backed grid displays photo, title, location, nightly price, and rating; no-review listings show New instead of an invented rating |
| SEARCH-01 | Location/date/guest search (PDF pg. 1) | Case-insensitive location matching; a complete date pair and guest count filter available capacity; inputs persist in URL and after refresh |
| SEARCH-02 | Categories and filters (PDF pg. 1) | Category/property type, inclusive nightly price range, and amenities combine correctly; all selected amenities must match; clear filters restores results |
| SEARCH-03 | Pagination (PDF pg. 2) | Stable numbered pagination, 12 listings per page by default, visible result count, no duplicate cards, page reset after filters change |
| DETAIL-01 | Property information (PDF pg. 2) | Deep link shows gallery, title, description, location, amenities, host information, and reviews; gallery supports open/close and previous/next |
| DETAIL-02 | Calendar and pricing (PDF pg. 2) | Calendar marks booked nights unavailable; valid range and guests produce itemized nightly subtotal, fees, and total from the API |
| BOOK-01 | Validated booking (PDF pg. 2) | Check-in precedes checkout, check-in is not in the past, guests are within capacity, and overlapping/unavailable stays are rejected server-side |
| BOOK-02 | Mock checkout/confirmation (PDF pg. 2) | Review page shows dates, guests, property, and exact total; explicit mock confirmation saves one booking; retry does not create another |
| BOOK-03 | My Trips (PDF pg. 2) | Active identity sees only their bookings with dates, guests, listing snapshot, total, and confirmation; past and upcoming stays are distinguishable |
| BOOK-04 | Durable availability (PDF pg. 2) | Booking survives page refresh and backend restart; booked nights disappear from matching searches and cannot be booked by another guest |
| HOST-01 | Create listing (PDF pg. 2) | Host saves title, description, at least one photo URL, nightly price, location, amenities, property type/category, and capacity; listing appears in explore |
| HOST-02 | Edit/delete listing (PDF pg. 2) | Owner edits persist; deletion requires confirmation and removes the property from discovery/new bookings; existing trips remain readable |
| HOST-03 | Host dashboard (PDF pg. 2) | Host sees owned listings and reservations for them; another identity cannot read those private reservation details or mutate the listings |
| UX-01 | Airbnb interaction fidelity (PDF pg. 2) | Navigation, photo cards, gallery, date picker, filters, dialogs, pagination, and action feedback follow DESIGN.md |
| FAV-01 | Simple wishlist (PDF pg. 2) | Signed-in user can save and unsave listings; hearts and wishlist agree; favorites persist per identity across refresh |
| DEMO-01 | Guest vs host notion (PDF pg. 2) | Every account can book and host; the UI switches between guest and hosting views. API enforces identity and ownership even if frontend controls are bypassed |
| AUTH-01 | Email/password signup/signin (user request, 2026-10-09) | Unique validated email, hashed password, HttpOnly session cookie backed by a database session, current-user endpoint, signout |
| AUTH-02 | Session lifecycle (user request, 2026-10-09) | Session survives refresh and backend restart, expires after 7 days, and signout deletes it. Mutations from other origins are rejected |
| SEED-01 | Immediately usable seed (PDF pg. 3) | Repeatable setup creates varied listings/photos, multiple hosts, guest identities, reviews, and existing past/future bookings |
| DOC-01 | Documentation (PDF pg. 3) | README describes setup, stack, architecture, schema, API, assumptions, demo limitations, and verification |
| SHIP-01 | Submission (PDF pg. 3) | Public GitHub repository contains frontend/ and backend/; hosted working link and repository link are recorded and submitted |

None of these rows is implemented yet. Mark a row done only after its UI and API path pass end to end, and record the evidence in AGENTS.md.

### Quality targets and optional scope

- P1 selected: mobile, tablet, and desktop support from DESIGN.md. The assignment lists responsiveness as a bonus; this plan includes it for usable core flows.
- P1 selected: basic keyboard accessibility, loading/empty/error states, reliable local assets, and server-enforced ownership.
- P2: interactive map, submitting reviews after a stay, per-category rating scores. (Rating aggregation, the Superhost badge and host photo upload were pulled forward at the user's request and are built.) (Dark mode was pulled forward at the user's request on 2026-10-11 and is built.)
- Placeholder-only: guest-host messaging, identity verification, real payments, and live pricing pins.
- Experiences and Services are visual navigation references, not required booking products. Show Coming soon when activated.
- Not planned: JWTs, refresh tokens, login throttling, OAuth, email verification/delivery, password reset, MFA, payment cards/refunds, messaging infrastructure, admin moderation, dynamic nightly pricing, multi-currency conversion, tax engines, cancellation/refund workflows.

A mock checkout must work; a Coming soon payment button cannot replace booking confirmation.

## 4. Primary journeys

### Discover and reserve

1. Visitor opens explore and sees useful seeded inventory.
2. Enters location, optional complete date range, and guests; selects categories/filters.
3. Search shows matching, available listings with count and pagination.
4. Opens listing; checks gallery, amenities, host, reviews, and availability.
5. Chooses dates/guests and sees server-calculated fees and total.
6. Selects Reserve; if needed, signs up or signs in, preserving the intended listing and search.
7. Checkout reviews the exact stay and labels the payment as simulated.
8. Confirmation persists the booking and presents a booking reference.
9. My Trips shows the stay; other guests can no longer reserve overlapping nights.

If inventory or price changes before confirmation, show a specific conflict, refresh availability/quote, and require the user to review the change before retrying.

### Host manages inventory

1. Sign in and switch to the hosting view.
2. Create a listing with validated fields and ordered photo URLs.
3. Saved listing becomes visible in public search and owned inventory.
4. Edit price/details and verify persistence.
5. Review reservations for owned listings.
6. Confirm removal; the listing is archived and unavailable for new bookings, while existing reservation records remain.

### Save favorites

1. Heart on a card/detail toggles a favorite; visitors are prompted to sign up or sign in.
2. Wishlist shows the active identity's saved active properties.
3. Removing a favorite updates all visible instances; a failed save restores the prior state.
4. Signing out and in as another account does not leak the previous account's wishlist.

## 5. Routes and screen responsibilities

| Route | Screen responsibility |
|---|---|
| / | Explore, global search, categories, seeded photo grid |
| /search?... | Shareable filtered results and pagination |
| /rooms/[id] | Gallery, property information, calendar, quote, host/reviews |
| /book/[listingId]?check_in=...&check_out=...&guests=... | Protected booking summary and mocked checkout |
| /bookings/[id]/confirmation | Private confirmation from persisted booking |
| /trips | Current identity's upcoming/past reservations |
| /wishlists | Current identity's saved active listings |
| /hosting | Host dashboard with inventory/reservation overview |
| /hosting/listings/new | Host create form |
| /hosting/listings/[id]/edit | Owned listing edit form |
| /hosting/reservations | Bookings for current host's listings |

Signup/signin, search on mobile, filters, gallery, and delete confirmation use dialogs/sheets. Direct links enforce identity/ownership rules. Unknown/archived properties show a helpful not-found state with a route back to search.

## 6. Product rules and explicit assumptions

These choices fill gaps in the PDF; adjust them consistently in architecture and tests if changed.

- Single demo currency: INR; store amounts as integer paise and format with an Indian locale. No conversion controls.
- Check-in/check-out are calendar dates, not timestamps. Use Asia/Kolkata for the demo's definition of today and disclose the simplification.
- A stay occupies [check-in, checkout). A new guest may arrive on the prior guest's checkout date.
- Check-in today is allowed; past check-in, zero-night, and reversed stays are invalid.
- Guest count is a positive integer and must not exceed listing capacity. One combined guest count; no adult/child/infant price rules.
- Category is one curated browse tag; property type is accommodation type. These remain separate filters.
- Price filter applies to nightly base price, excluding fees; label this explicitly.
- Pricing: nightly price x nights + one cleaning fee + service fee of 10% of nightly subtotal, rounded half-up to a whole paise. No taxes or payment charges.
- Persist accepted rate, fee breakdown, total, title/location/cover photo as booking snapshots. Listing edits do not change a confirmed booking.
- Quote is informational, not an inventory hold. Confirmation revalidates everything.
- Confirmed bookings block dates. Completion is derived from dates; cancellation is deferred.
- Delete means archive. Existing bookings remain valid and visible; a dialog explains this consequence.
- Seed/default listings use hand-picked Unsplash CDN photo URLs (no API key, not uploaded by us). Cloudinary is reserved for photos a real host uploads for their own listing; persist its asset IDs/URLs only for those. Photo URL entry (any HTTPS URL, not only Cloudinary) satisfies host CRUD; a host file-upload UI remains optional.
- Reviews are seeded and read-only. Display mean/count from available seeded reviews; no fabricated badges.
- Email/password sessions persist across refresh and restart. One opaque session token lives in an HttpOnly cookie; the database stores only its hash. Sessions last seven days with no renewal. Signout deletes the database session.
- Email verification, password recovery, and third-party verification are deferred. Backend auth completion does not complete the frontend user journey.
- Wishlist persistence in SQLite is a chosen implementation even though the PDF allows a simple version.

## 7. Design and interaction acceptance

Implementation convention agreed on 2026-10-09: all component styling uses Tailwind classes. globals.css defines shared colors, fonts, and sizing tokens. Pages compose shared components built from the installed shadcn primitives, including listing Cards and accessible Dialogs. This changes code organization without adding product scope.

Account-flow screenshot exception: the login Continue button uses a horizontal pink-to-magenta gradient (`#e61e4d → #e31c5f → #d70466`), 12px corners, 48px height, and a centered 16px semibold white label. Other standard buttons retain their documented solid fills and 8px corners.

Other gradients appear only as picture stand-ins, sampled from the reference screenshot (`docs/screencapture-getdesign-md-airbnb-*.pdf`): neutral photo skeleton/fallback, no-photo host/reviewer avatars, and Experiences/Services Coming-soon tiles. Icons follow DESIGN.md "Iconography": Tabler line icons for UI; product-tab illustrations, the Bélo logo, and the favicon are the real assets pulled from airbnb.co.in's own CDN (decided 2026-10-10 — literal clone assignment); ink (never gold) rating stars, white-outline/Rausch-filled heart states. "Guest favorite" badges and category rating stats appear only when backed by data.

Follow the detailed tokens in DESIGN.md. Explicit component definitions take precedence over conflicting descriptive shorthand: 14px property corners, 8px standard buttons, pill search, single shadow tier. Preserve the white/Rausch/ink palette, restrained typography, Inter fallback, photo-led density, and recognizable reservation panel.

Responsive target: one-column cards and search sheet below 744px; two columns at tablet; four from 1128px. Listing page has a desktop sticky rail and mobile sticky bottom summary that opens usable reservation controls.

Every data screen needs pending, success, empty, and failure behavior where applicable. Forms show field-level validation and retain input after errors. Pending mutations prevent duplicate clicks without hiding failure messages. Toasts supplement durable confirmation or inline errors.

Dialogs trap focus, close through Escape where appropriate, and restore focus. Controls have visible focus and names; calendar works by keyboard. Use expanded hit areas for small heart/date visuals. Check contrast and do not use color alone to convey errors or unavailable dates.

No exact live-site screenshot baseline was supplied. DESIGN.md is the current reference; document visual review evidence before declaring visual fidelity complete.

## 8. Data, reliability, and quality acceptance

- Required business mutations are persisted in SQLite and visible after backend restart.
- Backend validates every request and uses database transactions for final reservation.
- Competing booking requests for the same nights result in one success and one availability conflict, never two confirmed bookings.
- Unauthenticated protected requests fail; another identity's private booking is not exposed.
- Seed is repeatable without duplicating data or erasing evaluator-created bookings.
- Target at least 24 listings across 4 destinations, multiple categories/property types and price points, 3 hosts, 2 guests, 3-5 photos per listing, and representative reviews/bookings.
- Seed dates are relative to the initial seed date so availability remains demonstrable; rerunning seed must not shift existing reservations.
- Baseline test viewports: 390px, 820px, 1280px, 1536px; no horizontal overflow or blocked primary actions.
- Pagination bounds and eager-loaded related data keep responses bounded. Avoid adding an unmeasured latency guarantee.
- Production data persists in Turso independently of backend restarts; seed photos load directly from Unsplash's CDN and host-uploaded photos from Cloudinary's.

## 9. Definition of done and evaluation evidence

Each P0 row must have a working UI/API path and recorded verification. Required evidence:
1. Fresh setup and seed work from README commands.
2. Browse/search/filter/pagination and listing detail work with persisted inventory.
3. Booking creates a trip and blocks nights; conflict, adjacency, retry, and restart cases pass.
4. Host create/edit/archive and reservations work with ownership checks.
5. Favorites work per identity; placeholders are honest and actionable.
6. Frontend lint/type check/build and backend tests pass.
7. Responsive visual review covers principal screens and interaction states.
8. README includes schema, API overview, assumptions, commands, demo identities, and actual links.
9. Hosted smoke test succeeds, including persistent storage after restart.
10. Author can explain schema relationships, server validation, SQLite transaction behavior, and mocked boundaries.

## 10. Risks and unresolved delivery inputs

| Risk/input | Plan |
|---|---|
| Separate nested Git repositories | Preserve both histories; consolidate into a single delivery repository without destructive cleanup |
| 24-hour estimate | Implement P0 vertical slices first; defer P2 features |
| SQLite/libSQL transaction compatibility | Short atomic writes; verify concurrent booking and retry behavior on a separate Turso database |
| Backend runtime compatibility | Confirm host at deployment; verify Python 3.14, remote driver, quotas, and cold starts |
| Missing hosting accounts/repository name | Vercel, Turso, and Cloudinary (for host uploads) selected; backend provider and account setup remain delivery inputs |
| No provided deadline | Do not invent one; obtain from assignment communication when scheduling submission |
| Design reference gaps | Use explicit tokens and document calendar/error/loading/static-map decisions |
| Image reliability/quotas | Unsplash CDN for seed photos (no quota to track); Cloudinary only for host uploads, with fixed responsive sizes and a local fallback; monitor shared credits |
