# BookScan — Project Specification

## Overview
A personal web application for scanning book barcodes with a phone camera, looking up book metadata, storing it in a database, and generating eBay listings. Hosted on a Hetzner VPS behind an existing Apache reverse proxy.

## Goals
- Scan ISBN barcodes using a phone camera (no native app — browser only)
- Look up full book metadata from multiple sources in cascade
- Store all data in PostgreSQL
- Generate formatted eBay listing text (copy/paste)
- Future: post listings directly via eBay API

## Development Workflow
- Develop locally using Claude Code + Docker Compose
- Push to GitHub via Claude Code
- Deploy by manually running provided commands on the Hetzner server via SSH
- **Claude Code must always provide the exact server-side git/docker commands to run after each deployable change**

---

## Architecture

### Services (Docker Compose)
- `api` — FastAPI (Python), port 8001 internally
- `frontend` — React/Vite app, served by the API in production (or Nginx in container), port 3001 internally
- `db` — PostgreSQL 15, never exposed publicly

### Reverse Proxy
- Existing Apache server on Hetzner handles HTTPS and SSL (Let's Encrypt already configured)
- Add a new VirtualHost for this app pointing to port 3001 (or whichever port the frontend container exposes)
- Claude Code should generate the Apache VirtualHost config snippet but **the user will apply it manually**

### Deployment
```
Local dev → git push (Claude Code handles) → SSH to Hetzner → git pull && docker compose up -d --build
```

---

## Security
- Single-user authentication (no registration flow)
- Login via username + password stored as environment variables / `.env` file
- JWT session tokens (via `python-jose` + `passlib`)
- All routes protected except `/login`
- Rate limiting on all API endpoints, especially ISBN lookup
- Hetzner firewall: only ports 80, 443, SSH exposed
- PostgreSQL never exposed outside Docker network

---

## Two Distinct UIs (same React codebase, responsive)

### 1. Phone UI — Scan Mode
- Accessed on mobile browser
- Camera viewfinder front-and-center
- Triggers on barcode detection (debounced — no duplicate scans)
- Shows auto-filled metadata after scan
- Minimal editing inline (flag for desktop review if data incomplete)
- Large touch targets, one-handed usable
- Save button → next scan immediately

### 2. Desktop Dashboard
- Full inventory table: sortable, filterable, paginated
- Inline editing of all book fields
- "Incomplete data" filter (books missing key fields)
- Listing generator per book (formatted text + copy-to-clipboard)
- Bulk listing export (text or CSV)
- Listing history (track what has been listed)

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
| cover_image_local | TEXT | Local file path (downloaded copy) |
| data_sources | JSONB | Which sources provided which fields |
| data_complete | BOOLEAN | Flag: all key fields present |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `listings` table
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| book_id | UUID | FK → books |
| listing_text | TEXT | Generated eBay listing |
| created_at | TIMESTAMP | |
| ebay_listing_id | VARCHAR | Null until eBay API used |
| ebay_status | VARCHAR | draft / active / sold / ended |

---

## Book Metadata Lookup

### Cascade Strategy (in order)
1. **Open Library API** — free, no key, cover images, broad coverage
2. **Google Books API** — free tier, good descriptions, cover images
3. **Library of Congress SRU** — authoritative for obscure academic titles, publisher/edition data
4. **ISBNdb** — *(future/optional, paid)* best for physical specs (dimensions, weight)

### Merge Logic
- Query sources 1–3 in parallel
- Per-field priority: prefer LoC for publisher/edition/year; prefer Open Library/Google for description and cover
- Store `data_sources` JSONB field recording which source provided each field
- If key fields still missing after all sources: set `data_complete = false`, flag for manual review

### Cover Images
- Store remote URL immediately
- Download local copy to `/app/covers/{isbn}.jpg` for eBay API use later

---

## eBay Listing Template

Generated listing should include:
- **Title** (eBay-optimized format): `{Title} by {Author} ({Year}) {Edition} - {Publisher}`
- **Condition:** Used (manual field, not in DB — set at listing time)
- **Description block:**
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
- Copy-to-clipboard button on desktop UI

---

## Future Work (do not build now, but do not make architectural decisions that block these)
- eBay API integration (OAuth, `AddFixedPriceItem`, listing status sync)
- Price suggestion via eBay completed listings search
- ISBNdb integration for physical specs
- WorldCat fallback for truly obscure titles
- Bulk scan mode (rapid fire, review later)
- GitHub Actions for automated deployment on push

---

## Tech Stack Summary
| Component | Choice |
|---|---|
| Backend | Python 3.12, FastAPI |
| Frontend | React 18, Vite, TypeScript |
| Database | PostgreSQL 15 |
| ORM | SQLAlchemy 2.0 + Alembic migrations |
| Auth | python-jose, passlib, JWT |
| Barcode | zxing-js/browser (React component) |
| HTTP client | httpx (async) |
| Rate limiting | slowapi |
| Containers | Docker Compose |
| Reverse proxy | Apache (existing, user-managed) |
