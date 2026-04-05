# BookScan — CLAUDE.md

Personal web app for scanning book ISBN barcodes with a phone camera, looking up
metadata from public APIs, storing in PostgreSQL, and generating eBay listing text.

---

## Architecture

```
Phone/Desktop Browser
    ↕ HTTPS
Apache (Hetzner) — bookscan.luhrs.net :443
    ↕ HTTP proxy → :3001
Docker Compose:
  frontend  Nginx :3001 — serves React build, proxies /api/ → api:8001
  api       FastAPI :8001
  db        PostgreSQL :5432 (internal only)
    ↕
Open Library · Google Books · Library of Congress
```

- Nginx proxies `/api/*` to FastAPI — one domain, no CORS needed
- PostgreSQL is Docker-internal only
- External metadata APIs are called server-side only

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, python-jose, bcrypt, httpx, slowapi |
| Frontend | React 18, Vite, TypeScript strict, React Router v6, @zxing/browser, Vitest |
| Database | PostgreSQL 15 |
| Containers | Docker Compose |

---

## Running Locally

```bash
# Start (dev mode — hot reload on both api and frontend)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Run DB migrations (required on first start or after schema changes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api alembic upgrade head

# Stop
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

App runs at `https://localhost:3001` (Vite serves HTTPS using mkcert certs). mkcert certs are in
`frontend/localhost+1.pem` and `frontend/localhost+1-key.pem` — Vite loads them automatically if present.

For phone camera access, use `https://<mac-ip>:3001`. Accept the certificate warning in Safari or
install the mkcert CA root.

---

## Environment Variables

`.env` file in project root. Never commit it.

```
POSTGRES_USER=bookscan
POSTGRES_PASSWORD=...
POSTGRES_DB=bookscan
SECRET_KEY=...          # openssl rand -hex 32
APP_USERNAME=admin
PASSWORD_HASH=...        # see below — output of generate_hash.py, paste directly
```

**Important:** `PASSWORD_HASH` stores a bcrypt hash with `$` signs escaped as `$$` for Docker Compose.
`generate_hash.py` outputs the `$$`-escaped form automatically — paste its output directly into `.env`.

To update password:
```bash
# cd api && .venv/bin/python generate_hash.py '<password>'
# Paste output here as PASSWORD_HASH=<output>
# Then: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

The `$$` escaping is required because Docker Compose interpolates `$` in `env_file` values. The
container receives the correct `$2b$12$...` hash.

---

## Auth

- Single-user: `APP_USERNAME` + `PASSWORD_HASH` from `.env`
- Password verified with `bcrypt.checkpw()` (direct bcrypt, no passlib)
- JWT tokens via `python-jose`, 1-week expiry
- All routes protected except `POST /api/login`
- Rate limiting via slowapi on all endpoints, stricter on `/api/books/lookup/{isbn}`

---

## Key Decisions & Gotchas

**Docker Compose dev override strips migration step.** `docker-compose.dev.yml` overrides the CMD to
run uvicorn with `--reload`, skipping the `alembic upgrade head` that's baked into the prod Dockerfile
CMD. Always run migrations manually after first start or schema changes.

**Port mapping conflict.** The base `docker-compose.yml` has no `ports:` on the frontend service —
ports are declared only in the dev/prod overrides. Do not add `ports:` to the base file or Docker
Compose will merge both mappings and neither will bind.

**Vite proxy target inside Docker.** `vite.config.ts` proxies `/api` to `http://api:8001` (Docker
service name), not `localhost`. This is correct for dev mode running inside Docker.

**zxing cleanup.** `BrowserMultiFormatReader` in `@zxing/browser` 0.1.x has no `reset()` method.
Camera cleanup stops tracks directly via `videoRef.current.srcObject`.

**Cover download uses its own DB session.** The background cover download task opens a fresh
`async_session_maker()` session — it does not reuse the request-scoped session, which is closed by
the time the background task runs.

**HTTP 204 on DELETE.** `apiFetch` guards `resp.status === 204` and returns `undefined` rather than
calling `resp.json()`, which would throw on an empty body.

**Bcrypt password hashing.** The `.env` field is `PASSWORD_HASH`. `generate_hash.py` outputs a
`$$`-escaped bcrypt hash ready to paste directly into `.env`. The auth code uses `bcrypt.checkpw()`
(passlib was removed — incompatible with bcrypt ≥ 4.0.0). The test env in `pytest.ini` also uses
`PASSWORD_HASH`.

**Docker Compose `$` interpolation.** Docker Compose expands `$` in `env_file` values. Bcrypt hashes
contain `$` signs, so they must be stored as `$$` in `.env`. `generate_hash.py` handles this
automatically. If you ever edit the hash manually, replace each `$` with `$$`.

**Condition field.** Books have a `condition` column (VARCHAR 20): `New`, `Very Good`, `Good`,
`Acceptable`. Added in migration 002. The field appears in the desktop edit form, the phone review
form, the eBay listing text, and the CSV export.

**Manual barcode scanning.** `Scanner.tsx` no longer uses continuous `decodeFromVideoDevice`. It
starts the camera stream via `getUserMedia`, renders a targeting mask overlay (CSS box-shadow inset),
and on button press captures a single canvas frame cropped to the target rect and calls
`reader.decodeFromCanvas()`. The scan button shows "Retry" after an incomplete-data lookup.

**Scan audio.** `useScanAudio` hook uses Web Audio API (no files). AudioContext is created lazily on
first button press (satisfies mobile user-gesture requirement). Success: ascending 880/1108Hz chime.
Review: descending 440/330Hz tone.

**Phone vs desktop UI.** `PhoneReview` is the post-scan save form (phone only). `BookForm` is the
desktop edit form. `ScanPage` renders `PhoneReview`; `DashboardPage` renders `BookForm` for editing.

**Dashboard polling.** `DashboardPage` polls `GET /api/books` every 3 seconds via `setInterval`,
paused when tab is not visible (`visibilitychange` event). No WebSocket or backend changes needed.

**Design tokens.** All UI colors, fonts, radii, and shadows are in `frontend/src/styles/theme.ts`.
Do not add new hardcoded hex values to components — reference `theme.colors.*` etc. instead. Geist
and Geist Mono loaded from Google Fonts CDN in `index.html`.

**CSV export columns.** `GET /api/listings?format=csv` now outputs discrete book+listing columns
(title, author, publisher, edition, year, pages, dimensions, weight, subject, description, condition,
isbn, listing_text, created_at, ebay_status) — not the old listing_text blob.

**ISBN barcodes only.** The scanner picks up any barcode. Only barcodes starting with `978` or `979`
are book ISBNs — other barcodes will return empty metadata from the lookup APIs.

---

## Project Structure

```
bookscan/
├── docker-compose.yml          # prod base (no frontend ports)
├── docker-compose.dev.yml      # dev overrides (hot reload, port 3001)
├── .env                        # never commit
├── .env.example
├── api/
│   ├── Dockerfile              # prod CMD: alembic upgrade head && uvicorn
│   ├── requirements.txt
│   ├── generate_hash.py        # CLI: generate bcrypt hash for PASSWORD_HASH
│   ├── pytest.ini              # asyncio_mode=auto, in-memory SQLite for tests
│   ├── alembic/
│   │   └── versions/
│   │       ├── 001_initial_schema.py
│   │       └── 002_add_condition.py   # adds condition VARCHAR(20) to books
│   ├── app/
│   │   ├── main.py             # FastAPI app, slowapi, router registration
│   │   ├── config.py           # pydantic-settings v2
│   │   ├── database.py         # async engine, async_session_maker, Base
│   │   ├── auth.py             # JWT login + get_current_user dependency
│   │   ├── models.py           # Book, Listing ORM models (JSON not JSONB for SQLite compat)
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── books.py        # /api/books/* CRUD + /api/books/lookup/{isbn}
│   │   │   └── listings.py     # /api/books/{id}/listings + /api/listings
│   │   └── services/
│   │       ├── lookup.py       # parallel fetch + merge (Open Library, Google Books, LoC)
│   │       └── covers.py       # async cover download to /app/covers/
│   └── tests/
│       ├── conftest.py         # in-memory SQLite fixtures, AsyncClient, auth_headers
│       ├── test_auth.py
│       ├── test_books.py
│       ├── test_lookup.py
│       └── test_listings.py
└── frontend/
    ├── Dockerfile              # multi-stage: dev (Vite) / build / prod (Nginx)
    ├── nginx.conf              # serves /dist, proxies /api/ → api:8001, SPA fallback
    ├── vite.config.ts          # proxy: api:8001, HTTPS certs, test: jsdom
    └── src/
        ├── api/
        │   ├── client.ts       # apiFetch wrapper (Bearer token, 204 guard)
        │   ├── auth.ts         # login (form POST), getMe
        │   ├── books.ts        # lookupIsbn, saveBook, listBooks, updateBook, deleteBook, exportListingsCSV
        │   └── listings.ts     # generateListing, getBookListings, getAllListings
        ├── context/
        │   └── AuthContext.tsx # shared auth state (token, login, logout)
        ├── hooks/
        │   ├── useAuth.ts      # re-exports from AuthContext
        │   ├── useBreakpoint.ts # isMobile: window.innerWidth < 768
        │   └── useScanAudio.ts  # Web Audio API scan feedback tones
        ├── components/
        │   ├── Scanner.tsx     # @zxing/browser camera, single-frame capture, targeting mask
        │   ├── BookForm.tsx    # desktop book edit form (condition, retain flag)
        │   ├── BookTable.tsx   # sortable, filterable, aria-sort, confirm-delete
        │   ├── PhoneReview.tsx  # post-scan mobile save form (phone only)
        │   └── ListingGenerator.tsx # generate + copy-to-clipboard + history
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── ScanPage.tsx    # state machine: scanning/loading/review/error
        │   └── DashboardPage.tsx # search, filter, pagination, inline edit, listing overlay
        ├── styles/
        │   └── theme.ts        # Geist design tokens (colors, fonts, radii)
        └── types.ts            # Book, BookLookup, Listing, BookListResponse
```

---

## API Routes

All routes except `/api/login` require `Authorization: Bearer <token>`.

```
POST   /api/login
GET    /api/me

GET    /api/books/lookup/{isbn}      # fetch + merge metadata, no DB write (rate limited)
POST   /api/books                    # save book (409 on duplicate ISBN)
GET    /api/books                    # list (?page, ?page_size, ?incomplete_only, ?search)
GET    /api/books/{id}
PATCH  /api/books/{id}
DELETE /api/books/{id}               # returns 204

POST   /api/books/{id}/listings      # generate + save listing text
GET    /api/books/{id}/listings
GET    /api/listings                 # ?format=csv for bulk export
```

---

## Metadata Merge Priority

| Field | Priority |
|---|---|
| title, author | Open Library → Google Books → LoC |
| publisher, edition, year | LoC → Open Library → Google Books |
| description | Google Books → Open Library → LoC |
| cover_image_url | Open Library → Google Books |
| pages, subject | first non-null wins |

`data_complete = true` when title, author, publisher, year, and isbn are all present.

---

## Running Tests

```bash
# Backend
cd api && .venv/bin/pytest -v

# Frontend
cd frontend && npm run test
```

Tests use in-memory SQLite (backend) and jsdom + vitest (frontend). No external services needed.

---

## Deploying to Hetzner

```bash
# On the server after SSH
git pull && docker compose up -d --build
docker compose exec api alembic upgrade head
```

Apache VirtualHost (apply manually):
```apache
<VirtualHost *:443>
    ServerName bookscan.luhrs.net
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
</VirtualHost>
```

---

## Completed Iterations

**CHANGES-02** — all items implemented except DASH-01 (per-row eBay copy button, removed from scope):
- BUG-01: Review flag now clears on dashboard edit (with retain option)
- BUG-02/DASH-02: CSV export outputs discrete columns
- BUG-03: bcrypt password hashing via `PASSWORD_HASH` in `.env`
- SCAN-01/02/03: Single-frame capture with targeting mask and manual shutter button
- PHONE-01/02/03: `PhoneReview` form, scan button removed from desktop, dashboard polls at 3s
- DATA-01: `condition` column + migration 002
- AUDIO-01: Web Audio API scan feedback tones (`useScanAudio`)
- DESIGN-01: Geist design token system applied across all components

---

## Future Work

- DASH-01: Per-row eBay listing copy button (deferred)
- eBay API integration (OAuth, `AddFixedPriceItem`, status sync)
- ISBNdb for dimensions/weight
- WorldCat fallback for obscure titles
- Price suggestion via eBay completed listings
- Bulk scan mode (rapid fire, review later)
- GitHub Actions for automated deployment
