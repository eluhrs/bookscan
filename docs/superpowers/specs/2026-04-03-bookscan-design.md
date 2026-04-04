# BookScan — Design Document
_Date: 2026-04-03_

## Overview

A personal web application for scanning book ISBN barcodes with a phone camera, looking up metadata from free public APIs, storing books in PostgreSQL, and generating formatted eBay listing text. Hosted on a Hetzner VPS at `bookscan.luhrs.net` behind an existing Apache reverse proxy.

Single user, no registration flow. Phone UI for rapid scanning; desktop UI for inventory management and listing generation.

---

## System Architecture

```
Phone Browser / Desktop Browser
         ↕ HTTPS
Apache (Hetzner) — bookscan.luhrs.net :443
         ↕ HTTP proxy → :3001
┌─────────────────── Docker Compose ───────────────────┐
│  frontend (Nginx :3001)                               │
│    serves React/Vite static build                     │
│    proxies /api/* → api:8001                          │
│         ↕                                             │
│  api (FastAPI :8001)                                  │
│    REST endpoints, JWT auth, ISBN lookup, rate limit  │
│         ↕                                             │
│  db (PostgreSQL :5432 — internal only)                │
└───────────────────────────────────────────────────────┘
         ↕
Open Library · Google Books · Library of Congress
```

**Key decisions:**
- Nginx proxies `/api/*` to FastAPI — one domain, no CORS configuration needed
- PostgreSQL is Docker-internal only, never reachable from outside
- External metadata APIs are called server-side only — no API keys in the browser
- Google Books used via keyless free tier (sufficient for personal use)

**Local dev:** same Docker Compose, with `mkcert` providing a locally-trusted HTTPS cert for mobile testing over the local network.

---

## Project Structure

```
bookscan/
├── docker-compose.yml
├── docker-compose.dev.yml        # dev overrides (hot reload, mkcert)
├── .env.example
├── SPEC.md
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/                  # DB migrations
│   └── app/
│       ├── main.py
│       ├── auth.py               # JWT + login route
│       ├── models.py             # SQLAlchemy models
│       ├── schemas.py            # Pydantic schemas
│       ├── routers/
│       │   ├── books.py
│       │   └── listings.py
│       └── services/
│           ├── lookup.py         # parallel metadata fetch + merge
│           └── covers.py         # download cover images
│   └── tests/
│       ├── test_auth.py
│       ├── test_books.py
│       └── test_lookup.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf                # serves static + proxies /api/
│   └── src/
│       ├── main.tsx
│       ├── api/                  # typed fetch wrappers
│       ├── components/
│       │   ├── Scanner.tsx       # zxing-js camera component
│       │   ├── BookForm.tsx      # post-scan metadata form
│       │   └── ListingGenerator.tsx
│       ├── pages/
│       │   ├── ScanPage.tsx      # mobile UI
│       │   ├── DashboardPage.tsx # desktop UI
│       │   └── LoginPage.tsx
│       └── hooks/
│           └── useBreakpoint.ts  # switches between mobile/desktop layout
└── docs/
    └── superpowers/specs/
```

The mobile/desktop split is handled by `useBreakpoint` — same React app, same routes, layout adapts by screen width. No separate routing needed.

---

## Implementation Phases

### Phase 1 — Infrastructure & Auth
- Docker Compose (dev + prod configs), `.env.example`
- PostgreSQL + Alembic migrations (books + listings schema)
- FastAPI skeleton with JWT login (`/api/login`, `/api/me`)
- React app with login page, auth token storage
- Nginx config with `/api/` proxy
- mkcert setup for local HTTPS (mobile dev)
- Apache VirtualHost snippet for bookscan.luhrs.net
- _Deliverable: log in, see a blank dashboard_

### Phase 2 — Scan & Lookup
- `Scanner.tsx` — zxing-js camera component, debounced detection
- `GET /api/books/lookup/{isbn}` — parallel fetch, merge, return without saving
- Cover image download to `/app/covers/{isbn}.jpg`
- Mobile scan page: camera → metadata preview → save
- pytest: lookup merge logic, field priority rules
- _Deliverable: scan a book, see metadata, save it_

### Phase 3 — Desktop Dashboard
- Inventory table: sortable, filterable, paginated
- Inline editing of all book fields
- "Incomplete data" filter
- Vitest: table filtering, sort logic
- _Deliverable: full desktop inventory management_

### Phase 4 — Listing Generator
- Generate eBay listing text per book
- Copy-to-clipboard button
- Listing history (stored in `listings` table)
- Bulk export (text or CSV via `?format=csv`)
- _Deliverable: complete app, ready to use_

---

## API Routes

All routes except `/api/login` require `Authorization: Bearer <token>`.

```
POST   /api/login                    # { username, password } → { access_token }
GET    /api/me                       # token validation

GET    /api/books/lookup/{isbn}      # fetch + merge metadata, no DB write
POST   /api/books                    # save a book
GET    /api/books                    # list (paginated, filterable)
GET    /api/books/{id}
PATCH  /api/books/{id}               # inline desktop editing
DELETE /api/books/{id}

POST   /api/books/{id}/listings      # generate + save listing text
GET    /api/books/{id}/listings      # listing history for a book
GET    /api/listings                 # all listings (?format=csv for bulk export)
```

`GET /api/books/lookup/{isbn}` returns metadata without saving — the phone UI shows it for review first, then `POST /api/books` saves it on confirmation. Slowapi rate limiting applied on the lookup endpoint.

---

## Data Model

### `books` table
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| isbn | VARCHAR | ISBN-10 or ISBN-13 |
| title | TEXT | |
| author | TEXT | |
| publisher | TEXT | |
| edition | VARCHAR | |
| year | INTEGER | Publication year |
| pages | INTEGER | Optional |
| dimensions | VARCHAR | e.g. "9.2 x 6.1 x 1.3 inches" |
| weight | VARCHAR | e.g. "2.1 pounds" |
| subject | TEXT | Subject/category |
| description | TEXT | Blurb/summary |
| cover_image_url | TEXT | Remote URL |
| cover_image_local | TEXT | Local path `/app/covers/{isbn}.jpg` |
| data_sources | JSONB | e.g. `{"title":"open_library","description":"google_books"}` |
| data_complete | BOOLEAN | True when title, author, publisher, year, isbn all present |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `listings` table
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| book_id | UUID | FK → books |
| listing_text | TEXT | Generated eBay listing |
| created_at | TIMESTAMP | |
| ebay_listing_id | VARCHAR | Null until eBay API used (future) |
| ebay_status | VARCHAR | draft / active / sold / ended |

---

## Metadata Merge Logic

Sources queried in parallel: Open Library, Google Books, Library of Congress SRU.

| Field | Priority |
|---|---|
| title, author | Open Library → Google Books → LoC |
| publisher, edition, year | LoC → Open Library → Google Books |
| description | Google Books → Open Library → LoC |
| cover_image_url | Open Library → Google Books |
| pages, subject | any source, first non-null wins |
| dimensions, weight | ISBNdb (future) |

`data_complete = true` when all key fields are present: `title`, `author`, `publisher`, `year`, `isbn`.

`data_sources` JSONB records which source provided each field, powering the "Incomplete data" filter and source reliability auditing.

---

## eBay Listing Template

**Title:** `{Title} by {Author} ({Year}) {Edition} - {Publisher}`

**Description:**
```
Title: ...
Author: ...
Publisher: ...
Edition: ...
Year: ...
Pages: ...
Dimensions: ...
Weight: ...
Subject: ...

{description/blurb}
```

Condition is always "Used" in generated text — edit manually if needed. No condition field in the DB.

---

## Testing Strategy

- **pytest (backend):** Auth flow, book CRUD, merge logic unit tests, field priority rules. Metadata API calls mocked with `httpx` test transport.
- **Vitest (frontend):** Table filtering/sorting, listing text generator function, `useBreakpoint` hook. `Scanner.tsx` not unit-tested (hardware API — tested manually on phone).
- **No e2e tests** for now.

---

## Security

- Single-user: username + password in `.env`, no registration
- JWT tokens via `python-jose` + `passlib`
- All routes protected except `/api/login`
- Slowapi rate limiting on all endpoints, stricter on `/api/books/lookup/{isbn}`
- PostgreSQL internal to Docker network only
- Hetzner firewall: ports 80, 443, SSH only

---

## Deployment

**Apache VirtualHost snippet** (Claude Code generates, user applies manually):
```apache
<VirtualHost *:443>
    ServerName bookscan.luhrs.net
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    # SSL config inherited from existing Let's Encrypt setup
</VirtualHost>
```

**After each deployable change**, Claude Code provides:
```bash
git pull && docker compose up -d --build
```

---

## Future Work (not built now, architecture accommodates)
- eBay API integration (OAuth, `AddFixedPriceItem`, status sync)
- ISBNdb for dimensions/weight
- WorldCat fallback for obscure titles
- Price suggestion via eBay completed listings
- Bulk scan mode (rapid fire, review later)
- GitHub Actions automated deployment
