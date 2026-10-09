# Airbnb stays marketplace

Next.js + TypeScript frontend and FastAPI backend, with SQLite for local persistence. This repository includes the current implementation, seed data, migrations, tests, local UI assets, and planning documents.

## Requirements

- Node.js 20.9 or newer and npm. This machine uses Node.js 24.
- Python 3.14 or newer and uv.
- Internet access for dependencies, the Inter font during the Next.js build, and Unsplash listing photos.

No Turso or Cloudinary credentials are needed locally. Both dependency lockfiles are included.

## Run locally

Clone this repository:

~~~bash
git clone https://github.com/mehul79/airbnb_v1.git
cd airbnb_v1
~~~

In your first terminal, prepare and start the backend:

~~~bash
cd backend
uv sync --locked
cp .env.example .env
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
~~~

On Windows PowerShell, use `Copy-Item .env.example .env`. The defaults create `backend/dev.db`. The seed is safe to rerun without overwriting edits. Keep this terminal running.

In a second terminal, from the repository root:

~~~bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
~~~

On Windows PowerShell, use `Copy-Item .env.example .env.local`. Open http://localhost:3000. API documentation is at http://localhost:8000/docs and health is at http://localhost:8000/api/v1/health.

Use `localhost` consistently. Mutations must come from `FRONTEND_ORIGIN`, defaulting to `http://localhost:3000`. If you change the frontend hostname or port, update `backend/.env` and restart FastAPI. `frontend/.env.local` defines the server-only `API_BASE_URL`; restart Next.js after changing it.

## Demo data and accounts

The seed creates 24 listings across four regions, 78 photos, 47 reviews, and 22 past/upcoming bookings dated relative to the first seed run. All demo accounts use `demo-password`:

- `meera.kapoor@example.com`
- `arjun.nair@example.com`
- `kavya.rao@example.com`
- `rohan.verma@example.com`
- `ananya.iyer@example.com`

Every account can book and host; ownership controls host permissions. Seed photos use Unsplash URLs without an API key. Product icons and the logo/favicon are included locally.

## Current scope

The backend implements signup/signin/signout, persisted sessions, listing search/filters, details/reviews/availability, price quotes, atomic bookings with idempotency, and private trip APIs. The frontend includes authentication, API-backed search and listing detail screens, and profile. The landing page still uses mock listing rows.

Checkout/confirmation/trips screens, host CRUD, and persisted favorites remain unfinished. Some controls show Coming soon feedback. This is a runnable development snapshot, not a completed assignment or deployed application. No real payment is collected.

## Structure and configuration

- `frontend/`: Next.js, React, Tailwind, shadcn/Radix, Tabler icons, Inter, and Zustand for client UI/session state.
- `backend/`: FastAPI, SQLAlchemy, Alembic, seed data, pytest tests, and a pure-Python Turso HTTPS driver.
- `AGENTS.md`: execution plan and verification checklist.

FastAPI owns business data. Browser requests use the Next.js `/api/v1` relay; server-side reads call FastAPI directly. SQLite stores users, sessions, listings, photos, amenities, reviews, and bookings. Money is integer paise; stays use checkout-exclusive dates. Authentication uses scrypt passwords and an HttpOnly session cookie.

See [backend setup and API reference](backend/README.md), [frontend setup](frontend/README.md), and [design guide](frontend/DESIGN.md).

Environment templates are included. Actual environment files, credentials, databases, dependencies, caches, and logs are excluded. A fresh machine creates its database with migrations and the seed. For Turso configuration and opt-in remote tests, follow `backend/README.md` using your own credentials. Cloudinary upload is deferred and needs no configuration locally.

## Verification

From `backend/`:

~~~bash
uv run pytest
~~~

From `frontend/`:

~~~bash
npm run lint
npx tsc --noEmit
npm run build
~~~

For a production frontend process, run `npm run build` then `npm start`, keeping FastAPI available. Remote tests require a separate testing database. Planning documents include future requirements; their checklists do not imply all journeys are implemented.
