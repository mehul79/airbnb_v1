# Frontend

Next.js App Router with TypeScript, React, Tailwind 4, shadcn/Radix, Tabler icons, Inter, and Zustand. See the [root README](../README.md) to start both applications and seed the database.

## Setup

Requires Node.js 20.9 or newer and npm. Start FastAPI on port 8000 first.

~~~bash
npm ci
cp .env.example .env.local
npm run dev
~~~

On Windows PowerShell, use `Copy-Item .env.example .env.local`. Open http://localhost:3000.

`API_BASE_URL` is a server-only backend origin without `/api/v1`, defaulting to `http://localhost:8000`. Browser API calls use the same-origin `/api/v1` relay. Backend `FRONTEND_ORIGIN` must match the frontend origin for mutations.

## Verification and production process

~~~bash
npm run lint
npx tsc --noEmit
npm run build
npm start
~~~

`npm start` requires a completed build. Next.js generates environment/route types; generated output is excluded from Git. The build downloads Inter through `next/font/google`. Listing photos load from Unsplash; icons and favicon are committed locally.

## Current screens

- `/`: landing page with mock listing rows.
- `/search`: API-backed search, filters, and pagination.
- `/rooms/[id]`: API-backed details, gallery, availability, and pricing.
- `/users/profile`: profile page.
- Shared signup/signin dialog and navigation.

Checkout, confirmation, trips, host CRUD, and persisted favorites remain unfinished. Some actions display Coming soon.

Presentation rules live in [DESIGN.md](DESIGN.md). The execution plan is in [AGENTS.md](../AGENTS.md).
