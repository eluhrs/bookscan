# BookScan — CLAUDE.md

Personal web app for scanning book ISBN barcodes with a phone camera, looking up
metadata from public APIs, storing in PostgreSQL, and generating eBay listing text.

---

## Development Conventions
- Never join shell commands with && — run each command as a separate tool call so they can be approved individually and failures are clearly isolated

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

## Design Conventions

**Button labels (workflow screens):** Primary action buttons use ALL CAPS — `CAPTURE`, `LOOKUP`, `SAVE`, `SKIP`. Hint text references to buttons use Title Case — "tap Capture", "tap Lookup".

**Controls bar styling:** Controls bars on workflow screens have `border: 1px solid theme.colors.controlsBorder` (`#CCCCCC`). Interactive controls within (dropdowns, icon buttons) get `background: theme.colors.subtle` so they read as tappable.

**Step indicator zone:** `background: theme.colors.zoneBg` (`#E0E0E0`) — Zone 1 in WorkflowWrapper.

**Secondary button bar:** `background: theme.colors.zoneBg` (`#E0E0E0`) — Zone 6 in WorkflowWrapper. Secondary buttons within use `background: theme.colors.subtle`. The second button is labelled "Start Over" (not "Cancel").

**Colors:** All colors reference `theme.colors.*` from `frontend/src/styles/theme.ts`. Do not add hardcoded hex values to components. New tokens added in CHANGES-07: `zoneBg`, `controlsBorder`. Updated values in CHANGES-10: `zoneBg` (`#E0E0E0`), `controlsBorder` (`#CCCCCC`), added `footerButtonBg` (`#FFFFFF`).

**Lucide line art icons throughout:** All icons use Lucide React components — no emoji. Standard sizes: 18px in toolbar buttons, 16px in table cells. Components used: `Flashlight` (torch), `Keyboard` (keyboard mode toggle), `Camera` (camera mode toggle, camera mode button in keyboard controls), `FileWarning` and `Camera` in BookTable status icon column.

**Mobile device detection:** Use `isMobileDevice()` from `frontend/src/utils/deviceDetect.ts` for features that should only appear on genuine mobile devices. Checks `navigator.userAgent` regex and `navigator.maxTouchPoints > 0`. Do not use `useBreakpoint` (viewport width) for this purpose — it incorrectly triggers on resized desktop browsers.

**Workflow screen color zones:** Content background `theme.colors.surface` (`#FFFFFF`), header/footer zones `theme.colors.zoneBg` (`#E0E0E0`), footer buttons `theme.colors.footerButtonBg` (`#FFFFFF`) with `1px solid theme.colors.controlsBorder` border. Toolbar buttons use `theme.colors.subtle` (`#F4F4F4`) fill with `1px solid theme.colors.controlsBorder` (`#CCCCCC`) border — no container border around the toolbar row.

**Consistent inner spacing:** `WorkflowWrapper` uses a middle flex container with `gap: 0.75rem` and `padding: 0.75rem 1rem` for equal whitespace between controls bar, content area, hint text, and primary button. Camera view content inside workflow steps must NOT add its own outer padding — the wrapper gap handles it.

**Primary button height:** 64px (`minHeight: 64`) across all workflow screens, via `WorkflowWrapper` Zone 5.

---

## Key Decisions & Gotchas

**iOS keyboard and WorkflowWrapper layout.** `position: fixed` on child zones does not reliably keep them visible when the iOS Safari keyboard opens — iOS repositions fixed elements relative to the layout viewport, which scrolls when the keyboard appears. The working approach: the outer container is `position: fixed` with `top:0, left:0, right:0` and its `height` and `transform: translateY()` are set to `window.visualViewport.height` and `window.visualViewport.offsetTop` respectively, updated via `visualViewport` `resize`/`scroll` event listeners. All zones inside use normal flex column flow — no `position: fixed` on any child. In jsdom (tests), `visualViewport` is undefined; the `if (!vv) return` guard in the useEffect handles this gracefully.

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

**Manual barcode scanning — how it works.** Several techniques combine to make scanning reliable
across phone cameras:

1. **High resolution request.** `getUserMedia` requests `{ width: { ideal: 1920 }, height: { ideal: 1080 } }`. Phones typically grant 1080p or better, giving the decoder many pixels of barcode detail even when the phone is held further back.

2. **Multi-crop decode loop.** On each button press, `Scanner.tsx` tries three crop strategies in sequence and returns on the first success. All crops are taken from the center of the video frame:
   - Strategy 1 — standard: 80% × 40% of the frame, 1:1 scale
   - Strategy 2 — wide strip: 95% × 25% of the frame (catches barcodes near the horizontal edges)
   - Strategy 3 — center zoom: 50% × 30% of the frame stretched 2× digitally (helps cameras that need distance to focus and can't resolve fine lines at close range)

3. **Torch toggle.** A flashlight button appears in the top-right corner of the viewfinder when `track.getCapabilities().torch` is true. Activates via `applyConstraints({ advanced: [{ torch: true }] })`. Torch state persists across scans via a module-level `persistedTorchOn` variable — see below.

4. **Targeting mask.** The dark overlay with a transparent centered rect guides the user to align the barcode. The rect is sized to roughly match the button height (flex proportions 4:2:3 — camera:button:messages) and is vertically centered with 25% padding above and below.

Library: `@zxing/browser` — adequate for this use case when given sufficient resolution. If future
testing shows persistent failure on low-end devices, evaluate `@undecaf/zbar-wasm` (ZBar compiled
to WASM, stronger for 1D/EAN barcodes) as a drop-in replacement.

**Torch state persistence across scans.** When the user saves a book and returns to the scan screen, the Scanner component remounts — React state resets to false but the torch may still be physically on. Fix: a module-level variable `let persistedTorchOn = false` outside the component. `useState(persistedTorchOn)` initializes from it on each mount. `handleTorchToggle` writes to it before calling `applyConstraints`. On new stream start, if `persistedTorchOn` is true, `applyConstraints({ torch: true })` re-fires. The cleanup effect does NOT reset `torchOn` state or turn the torch off — stopping the track already powers it down physically, and the persisted value handles restoration on remount. Do not add `applyConstraints({ torch: false })` to cleanup; it races with `t.stop()` and has no reliable effect.

**Scan audio.** `useScanAudio` hook uses Web Audio API (no files). AudioContext is created lazily on
first button press (satisfies mobile user-gesture requirement). Success: ascending 880/1108Hz chime.
Review: descending 440/330Hz tone.

**Phone vs desktop UI.** The old `PhoneReview` / `ScanPage` / `Scanner` components were deleted in CHANGES-04 and replaced by the photo workflow. `BookEditCard` is the dashboard edit form rendered by `DashboardPage` for editing — `BookForm` was replaced in CHANGES-12.

**Photo workflow (CHANGES-04).** Multi-step flow: Photograph → Lookup → Review. Photos held in browser memory as `File` objects until Save; uploaded via `POST /api/books/{id}/photos` after book creation. Photo files stored at `/app/photos/{book_id}/{photo_id}.jpg` in a named Docker volume (`photos:/app/photos` in both `docker-compose.yml` and `docker-compose.dev.yml`).

**book_photos table.** Separate table (not JSON column on books) enables individual row deletes and per-book queries. `has_photos: bool` computed via EXISTS subquery in the router — not a model column. `passive_deletes=True` on the relationship + `ON DELETE CASCADE` on the FK means the DB handles cascade, not SQLAlchemy. Book DELETE also removes files from disk via `shutil.rmtree` in the delete handler.

**LookupStep barcode capture.** Verbatim copy of the capture logic from the deleted `Scanner.tsx`: high-res `getUserMedia` (via `useCameraStream`), 3-strategy crop loop. Do not simplify — this combination was hard-won. See Scanner.tsx in git history (search for "SCAN-01" in commit messages) if the logic needs review. `persistedTorchOn` now lives in `useCameraStream.ts`, not LookupStep.

**Photo retry on save failure.** `PhotoWorkflowPage` stores `savedBookId` after successful `POST /api/books`. If the subsequent photo upload fails, `ReviewStep` retries only the upload on re-tap of SAVE — it does not re-create the book.

**Blob URLs for photo display.** Dashboard photo grid fetches each photo via `GET /api/photos/{id}/file` (authenticated) and renders as blob URL. Blob URLs are revoked (`URL.revokeObjectURL`) when the edit view closes to prevent memory leaks.

**useCameraStream hook.** Shared camera setup for PhotographStep and LookupStep. Module-level `persistedTorchOn` lives here. Pass `enabled: false` to disable (LookupStep passes `mode === 'camera'`; camera shuts off automatically in keyboard mode). A `cancelled` flag inside the effect body prevents a race where `getUserMedia` resolves after the component unmounts — the `.then()` handler checks `cancelled` and stops the stale stream. Both steps unmount their cameras cleanly via the hook's cleanup effect.

**PhotographStep live camera.** Uses `useCameraStream` hook and Canvas API frame capture. `captureAndCompress` draws the current video frame to a canvas, resizes to max 1200px, encodes as JPEG at 85% quality, and wraps in a `File` object. No file picker — camera is always live on this step. Photo count target (1-5) persists in localStorage. Progress shown as □/■ indicators in controls bar.

**WorkflowWrapper hintText prop.** Optional string rendered in a zone between main content and primary button. Pass `undefined` (or omit the prop) to hide the zone entirely. ReviewStep passes no hintText (no hint shown). The hint text zone is always positioned above the primary button regardless of content height.

**Dashboard polling.** `DashboardPage` polls `GET /api/books` every 3 seconds via `setInterval`,
paused when tab is not visible (`visibilitychange` event). No WebSocket or backend changes needed.

**Design tokens.** All UI colors, fonts, radii, and shadows are in `frontend/src/styles/theme.ts`.
Do not add new hardcoded hex values to components — reference `theme.colors.*` etc. instead. Geist
and Geist Mono loaded from Google Fonts CDN in `index.html`.

**CSV export columns.** `GET /api/listings?format=csv` now outputs discrete book+listing columns
(title, author, publisher, edition, year, pages, dimensions, weight, description, condition,
isbn, listing_text, created_at, ebay_status) — not the old listing_text blob. `subject` was removed in CHANGES-12.

**ISBN barcodes only.** The scanner picks up any barcode. Only barcodes starting with `978` or `979`
are book ISBNs — other barcodes will return empty metadata from the lookup APIs.

**Dimensions and weight — data unavailability.** The `dimensions` and `weight` fields exist in the
schema and `BookData` but are never populated. None of the current free sources carry physical specs:
Open Library has no dimensions/weight fields, Google Books has no physical specs in `volumeInfo`,
and the LoC MODS schema does not include them. ISBNdb (paid, ~$10/month) is the most practical
source for physical specs and would be the right call once eBay listing accuracy matters enough to
justify the cost. Until then, dimensions and weight will be blank in all listings.

**Haptic feedback (Web Vibration API).** All key events call `navigator.vibrate?.(25)` (medium intensity, 25ms). Safari/iOS does not support `navigator.vibrate` — the optional chain (`?.`) makes it a silent no-op on unsupported platforms; no error is thrown. Haptic feedback via Web Vibration API is not supported on iOS/Safari or any iOS browser — this is an Apple platform restriction at the WebKit level with no available workaround. Chrome, Firefox, and all other browsers on iOS are also affected (Apple forces all iOS browsers to use WebKit). Android Chrome supports haptics fully. The haptic code is intentionally retained to benefit Android users. Do not treat iOS lack of haptics as a bug.

**BookEditCard inline editing.** `BookEditCard` replaces `BookForm` as the dashboard edit form. All text fields (title, author, pages, publisher, edition, dimensions, weight, description) use an `InlineField` component: hover shows a 0.5px border, click switches to input/textarea, blur returns to display mode. Pending edits accumulate in `DraftFields` state and are committed together on "Save Changes". ISBN is rendered read-only (`<span>`) — it is a unique key and not patchable via the API. Checkboxes (Review Metadata?, Review Photography?) save immediately via `onImmediateSave` — independent of the Save Changes button. Empty fields display as `—` (em dash) in italic tertiary color via `placeholder="—"`.

**Save confirmation overlay.** After successful save, `PhotoWorkflowPage` transitions to a `'confirmation'` step (added to the `WorkflowStep` union) that renders a full-screen Check icon for 800ms, then resets all state and transitions to `'photograph'`. `playSuccess()` fires in the `useEffect` that handles the `'confirmation'` step, not in `ReviewStep.handleSave`. `ReviewStep` no longer imports `useScanAudio`.

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
│   │       ├── 002_add_condition.py   # adds condition VARCHAR(20) to books
│   │       ├── 003_add_book_photos.py     # adds book_photos table with book_id FK cascade
│   │       ├── 004_add_needs_photo_review.py  # adds needs_photo_review BOOLEAN to books
│   │       └── 005_drop_subject.py        # drops subject column from books
│   ├── app/
│   │   ├── main.py             # FastAPI app, slowapi, router registration
│   │   ├── config.py           # pydantic-settings v2
│   │   ├── database.py         # async engine, async_session_maker, Base
│   │   ├── auth.py             # JWT login + get_current_user dependency
│   │   ├── models.py           # Book, Listing ORM models (JSON not JSONB for SQLite compat)
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── books.py        # /api/books/* CRUD + /api/books/lookup/{isbn}
│   │   │   ├── listings.py     # /api/books/{id}/listings + /api/listings
│   │   │   └── photos.py       # /api/books/{id}/photos + /api/photos/* endpoints
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
        │   ├── useScanAudio.ts  # Web Audio API scan feedback tones
        │   └── useCameraStream.ts # getUserMedia, torch, stream cleanup — shared by PhotographStep and LookupStep
        ├── components/
        │   ├── workflow/
        │   │   ├── WorkflowWrapper.tsx  # shared 6-zone layout for all 3 steps
        │   │   ├── PhotographStep.tsx   # step 1: live camera capture, portrait mask, □/■ progress
        │   │   ├── LookupStep.tsx       # step 2: barcode camera + keyboard fallback
        │   │   └── ReviewStep.tsx       # step 3: condition/flag/save with photo upload
        │   ├── BookEditCard.tsx  # structured card layout with inline editing (replaces BookForm)
        │   ├── PhotoFilmstrip.tsx  # reusable filmstrip: cover + user photos, add/delete
        │   ├── BookTable.tsx   # sortable, filterable, aria-sort, has_photos indicator
        │   └── ListingGenerator.tsx # generate + copy-to-clipboard + history
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── PhotoWorkflowPage.tsx  # state machine for Photograph→Lookup→Review
        │   └── DashboardPage.tsx # search, filter, pagination, inline edit, photo grid
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

POST   /api/books/{id}/photos        # upload 1+ photos (multipart/form-data)
GET    /api/books/{id}/photos        # list BookPhotoResponse[]
DELETE /api/photos/{photo_id}        # 204, deletes file + DB row
GET    /api/photos/{photo_id}/file   # FileResponse (authenticated)
```

---

## Metadata Merge Priority

| Field | Priority |
|---|---|
| title, author | Open Library → Google Books → LoC |
| publisher, edition, year | LoC → Open Library → Google Books |
| description | Google Books → Open Library → LoC |
| cover_image_url | Open Library → Google Books |
| pages | first non-null wins |

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
git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api alembic upgrade head
```

**Important:** Always include `-f docker-compose.prod.yml`. Without it the frontend port is not mapped and Apache gets a 503. `docker-compose.prod.yml` binds the frontend to `127.0.0.1:3001` (localhost only — not publicly exposed).

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

**CHANGES-03** — all items implemented:
- BUG-01: CSV export now queries books with `selectinload(Book.listings)` — books without listings were previously omitted
- BUG-02: Delete for pre-v2 records fixed with `passive_deletes=True` on `Book.listings` relationship — SQLAlchemy was trying to null `book_id` before delete, which fails on a NOT NULL column; cascade is now handled by the DB FK constraint
- BUG-03: Removed both `confirm()` calls (one in `BookTable.tsx`, one in `DashboardPage.tsx`) — delete now executes immediately
- BUG-04: Added `onScanFail` prop to `Scanner.tsx`; negative sound now plays on both barcode-not-found and incomplete-metadata paths
- DATA-01: Investigated dimensions/weight — data unavailability confirmed (see "Dimensions and weight" gotcha above)
- SCAN-01: Camera reliability overhaul — high resolution request, 3-strategy multi-crop decode loop, torch toggle, module-level torch state persistence; see "Manual barcode scanning" gotcha above
- Scan UI: 3-section flexbox layout (`100dvh`) — camera (flex:4), button (flex:2), messages (flex:3); targeting mask vertically centered at `top/bottom: 25%`; torch button overlaid top-right of viewfinder

**CHANGES-04** — all items implemented:
- FEAT-01: Multi-step Photograph → Lookup → Review workflow replaces old /scan flow
- Photo storage: `book_photos` table (separate from cover images); individual photos deletable
- `has_photos: bool` on `BookResponse` via EXISTS subquery — no denormalized column needed
- "Flag for review" maps to `data_complete = false` (explicit override preserved on save)
- Barcode capture logic in `LookupStep` copied verbatim from deleted `Scanner.tsx`
- `Poor` added as 5th condition option across `ReviewStep` and `BookForm`
- Dashboard: photo grid in book edit view; missing-photos indicator in `BookTable`
- `WorkflowWrapper` enforces consistent six-zone layout across all three steps
- Old `ScanPage`, `Scanner`, `PhoneReview` deleted (recoverable via git)
- Migration 003: `book_photos` table with FK cascade and `book_id` index

**CHANGES-05** — both items fixed:
- BUG-05: Audio triggers reinstated — `useScanAudio` now resumes suspended `AudioContext` before scheduling tones (`ctx.resume().then(schedule)`), so tones play even when the context was created post-async (after `await lookupIsbn()`). Removed `ctx.close()` from cleanup to prevent the save-success chime from being cut off when `ReviewStep` unmounts immediately after `onSaveComplete()`.
- BUG-06: Cancel guard added — `stepRef` in `PhotoWorkflowPage` tracks current step immediately (before React re-renders); `handleLookupComplete` bails if `stepRef.current !== 'lookup'`, preventing in-flight lookup API responses from overriding a cancel press and sending the user to the Review screen against their intent.

**CHANGES-06** — all items implemented:
- Live camera capture in PhotographStep: replaces native file picker with getUserMedia stream, frame capture via canvas, compression to max 1200px/85% JPEG
- useCameraStream hook: extracted from LookupStep; shared by both PhotographStep and LookupStep; handles getUserMedia, torch detection/toggle, persistedTorchOn module-level state, stream cleanup; cancelled flag guards against unmount race on async getUserMedia
- WorkflowWrapper redesign: #FAFAFA background throughout; step indicator with ●/○ markers and "Metadata" label for lookup step; hintText prop adds optional hint text zone between content and primary button; Dashboard|Cancel as equal-width secondary buttons at bottom; old top header zone removed
- PhotographStep controls bar: # photo count dropdown (left), □/■ progress indicators (center), torch button (right)
- Portrait mask: 3:4 portrait orientation target rectangle with blue corner brackets and dynamic hint text (front cover/back cover/spine/additional) overlaid inside mask
- Landscape mask in LookupStep: updated to rounded rectangle with same corner bracket style as portrait mask
- ReviewStep: light theme; cover thumbnail 2:3 aspect ratio; condition buttons highlight in #0070F3 when selected; checkbox label updated to "Mark for Review?"
- New theme tokens added: subtle (#F5F5F5), subtleText (#333333), disabled (#D1D5DB), disabledText (#9CA3AF)
- BUG-01 (cancel paths): confirmed functional after redesign
- BUG-02 (audio triggers): confirmed all 5 trigger points functional after redesign

**CHANGES-07** — all items implemented:
- FEAT-01: Button case convention documented; hint text "then capture" → "then Capture" fixed
- FEAT-02/03: Step indicator and secondary button bar zones get `theme.colors.zoneBg` (`#F0F0F0`) background via WorkflowWrapper
- FEAT-04: "Cancel" renamed "Start Over" across all workflow screens
- FEAT-05/08/09: Controls bar treatment — `1px theme.colors.controlsBorder` border, interactive controls get `theme.colors.subtle` fill
- FEAT-06: Photo count dropdown extends to 0–5; at 0, progress indicators hidden and button label changes to SKIP
- FEAT-07: SKIP advances to Metadata step; sets `skippedPhotography=true` in page state
- BUG-01: Portrait mask replaced with largest square using `ResizeObserver`
- BUG-02: Hint text "Set number of images, position book, then Capture" moved inside mask pill; duplicate below camera removed
- BUG-03/06/12: All primary buttons share `minHeight: 56px` via WorkflowWrapper
- BUG-04: Landscape barcode mask widened to ~3:1 ratio (`top:32% bottom:32%`)
- BUG-05: Hint text "Align barcode then tap Lookup, or use keyboard" moved inside mask pill; errors surface via WorkflowWrapper `hintText` only
- BUG-07/08/09: `visualViewport` resize detection in keyboard mode — LOOKUP + secondary buttons stay above keyboard, step indicator + controls anchored top, input centered in remaining space
- BUG-10: 📷 emoji replaced with Lucide `<Camera />` icon
- BUG-11: Field heading removed; placeholder: "Type ISBN-10 or ISBN-13, then tap Lookup" with darker placeholder color via injected `<style>`
- Migration 004: `needs_photo_review BOOLEAN NOT NULL DEFAULT FALSE` added to books table
- ReviewStep: "Mark for Review?" → "Review Metadata?"; new "Review Photography?" checkbox (auto-checked on SKIP); `needs_photo_review` saved to DB on book creation
- Dashboard display of `needs_photo_review` deferred to future CHANGES file

**CHANGES-08** — all items implemented:
- FEAT-01: Review screen controls bar has no border and no interactive content. Zone 2 always renders at standard height (`minHeight: 2.75rem`, no background, no border) for consistent vertical rhythm across steps — the border lives inside the controls content for Photograph/Lookup steps, so it is simply absent on Review.
- FEAT-02/03: Horizontal scrollable filmstrip replaces old cover+metadata side-by-side layout; cover image renders first (leftmost) with 2px `theme.colors.accent` border (signals lookup result, not deletable); user photos follow with ✕ delete buttons overlaid top-right; filmstrip separated from metadata by a `1px theme.colors.border` bottom border.
- FEAT-04: "Review Photography?" checkbox auto-checks when all user photos deleted from filmstrip; `localPhotos` state (copy of `photos` prop) tracks remaining photos independently — deletions reversible until Save is tapped; blob URLs created/revoked via `useEffect` on `localPhotos`. DB field: uses existing `needs_photo_review` from migration 004. **Naming note:** CHANGES-08.md spec used the name `needs_photography` — this is the same field as `needs_photo_review` added in migration 004. No new migration was needed. Always use `needs_photo_review` in code.
- BUG-01: Title (bold, 2-line `-webkit-line-clamp:2`, `overflow:hidden`) and author (1-line, `text-overflow:ellipsis`, `white-space:nowrap`) in both ReviewStep and BookTable; BookTable title `maxWidth:220`, author `maxWidth:160`.
- BUG-02: SAVE button state confirmed correct after filmstrip changes — blue (`theme.colors.accent`) when condition selected, `theme.colors.disabled` + `disabled` attr when not.
- FEAT-05: Layout order confirmed: step indicator (#F0F0F0) → empty controls bar (whitespace only) → filmstrip → title → author → year·publisher → conditions → checkboxes → SAVE → secondary bar (#F0F0F0).

**CHANGES-09** — all items implemented:
- BUG-01: Root URL `/` always redirects to `/dashboard` regardless of device type. `useBreakpoint` removed from `App.tsx`.
- FEAT-01: Mobile-only Camera scan button in dashboard header (left of Log out, only when `isMobile`). Navigates to `/scan`. Desktop sees no scan button.
- BUG-02: Already completed in CHANGES-08 — `BookTable.tsx` already had two-line title clamp and one-line author ellipsis.
- FEAT-02: 800ms full-screen save confirmation overlay (Check icon, `#FAFAFA` background) appears after successful save. Transitions automatically to fresh Photograph screen. `playSuccess()` moved from `ReviewStep` to `PhotoWorkflowPage`'s confirmation `useEffect` so sound fires at the moment the checkmark appears.
- FEAT-03: Haptic feedback (`navigator.vibrate?.(25)`, medium intensity) on all four key events: photo captured (`PhotographStep.handleCapture`), lookup success (`PhotoWorkflowPage.handleLookupComplete`), lookup failure (`LookupStep` — both barcode-not-found and API-failure paths), save success (`PhotoWorkflowPage` confirmation useEffect). Safari/iOS does not support the Web Vibration API — this is a known limitation, not a bug. Android browsers support it fully.

**CHANGES-10** — all items implemented:
- FIX-01: Primary button height increased to 64px via WorkflowWrapper Zone 5
- FIX-02: Unified color system — `surface` #FFFFFF, `zoneBg` #E0E0E0, footer buttons `footerButtonBg` #FFFFFF; toolbar container border removed, individual button borders via `controlsBorder` #CCCCCC; equal header/footer height (minHeight 3rem); consistent inner spacing via middle wrapper gap
- FIX-03: Emoji icons replaced with Lucide line art — `Flashlight` (torch), `Keyboard` (keyboard mode), `Camera` (camera mode)
- FIX-04: Header/footer scrolling in keyboard mode resolved by FIX-02 refactor (flexShrink:0 + visualViewport height)
- FIX-05: ISBN placeholder font size reduced to 0.82rem via CSS placeholder rule
- FIX-07: Mobile detection changed from viewport width to user-agent + maxTouchPoints (`isMobileDevice()` utility)
- FEAT-01: BookTable status icon column — two fixed-width slots: FileWarning (amber, when !data_complete) + Camera (#0070F3, when needs_photo_review); camera emoji removed from title column
- FEAT-02: Per-book photo ZIP download — `GET /books/{id}/photos/download` backend endpoint (stdlib zipfile, no new deps) + Download Photos button in dashboard edit view

**CHANGES-11** — all items implemented (plus two QA-discovered fixes):
- FIX-08: Camera stream health monitoring and automatic recovery — `sampleIsBlack()` (16×16 canvas, luminance < 5 threshold), black frame check every 2s via `setInterval`, 'ended' event listener on track, `visibilitychange` listener; `restartRef` pattern lets async handlers always call current `startStream` closure; recovery is silent (no permission re-prompt)
- FIX-09: iOS keyboard layout — `WorkflowWrapper` outer container is `position: fixed` tracking `window.visualViewport.height` and `offsetTop` via resize/scroll listeners; all zones (1, 2, 6) use normal flex flow inside the container — no `position: fixed` on child zones; container shrinks/translates to match visual viewport when keyboard opens
- FIX-10A: Listing panel first field renamed from "TITLE:" to "LISTING TITLE:" in `generate_listing_text()` in `api/app/routers/listings.py`
- FIX-10B: Description/blurb field added to listing panel in `ListingGenerator.tsx` — shown only when `book.description` is non-empty
- FIX-10C: Download Photos ZIP button added to listing panel — shown only when `book.has_photos` is true; `downloading` state guard prevents double-tap; reuses `downloadPhotosZip` from `api/photos`
- FIX-11: `PhotoFilmstrip` component extracted from `ReviewStep` into `frontend/src/components/PhotoFilmstrip.tsx`; reused in `DashboardPage` edit view (replaces old photo grid); API: `coverUrl`, `photos: Array<{key, url}>`, `onDelete: (key) => void`; stable UUID keys in `ReviewStep` via `crypto.randomUUID()` at state entry
- QA fix: `BookForm` gained `hideCover?: boolean` prop; `DashboardPage` passes `hideCover` so `BookForm` doesn't render a second cover when the filmstrip already shows it
- Note: description field rarely populated — sourced from Google Books only (OL fetcher never extracts description; OL Works endpoint not called); many books have no description in Google Books

**CHANGES-12** — all items implemented:
- FEAT-01: Dashboard book edit page redesigned as structured `BookEditCard` component — replaces `BookForm`
- Six zones: Filmstrip (reuses `PhotoFilmstrip`), Title/Author/Status (inline editable + condition dropdown + immediate checkboxes), Core fields (ISBN read-only, Pages/Publisher inline editable), Description (inline textarea, em dash when empty), Additional fields (Edition/Dimensions/Weight, all editable, em dash when empty), Footer (added date + Generate Listing + Save Changes)
- Inline editing pattern: hover shows 0.5px border, click activates input/textarea, blur returns to display; all pending changes committed together on Save Changes
- Checkboxes (Review Metadata? / Review Photography?) save immediately via `onImmediateSave`, independent of Save Changes
- ISBN rendered read-only — not patchable via `PATCH /api/books/{id}`; silently discarded if included
- `PhotoFilmstrip` extended with `onAddPhoto` prop and `+` placeholder for adding photos from dashboard edit view
- `subject` field removed from DB (migration 005), backend models/schemas/routers/services, frontend types, and all test fixtures
- `BookForm.tsx` deleted; `BookForm.test.tsx` deleted; `DashboardPage` updated to render `BookEditCard`
- `LookupStep.tsx` unused `useEffect` import removed (pre-existing TS error surfaced by `tsc --noEmit`)

**CHANGES-13** — all items implemented:
- FIX-12: Horizontal scroll on camera workflow screens fixed — `maxWidth: '100vw'` added to `WorkflowWrapper` outer container
- FIX-13: Border color unified to `#E0E0E0` (matching `zoneBg` header/footer darkness) — single change to `theme.colors.border` propagates globally
- FEAT-01: Mobile-responsive dashboard table — CSS media queries hide author/publisher/year/condition columns on `max-width: 767px`; desktop text action buttons (List/Edit/Delete) replaced by Lucide `Pencil`/`Trash2` icon buttons on mobile; row tap navigates to edit card; `stopPropagation` on all action buttons prevents double-fire with row click
- FEAT-02: Condition column removed from desktop dashboard table; `CONDITION_COLOR` constant deleted; condition remains visible and editable on `BookEditCard`

---

## Future Work

- DASH-01: Per-row eBay listing copy button (deferred)
- eBay API integration (OAuth, `AddFixedPriceItem`, status sync)
- ISBNdb for dimensions/weight
- WorldCat fallback for obscure titles
- Price suggestion via eBay completed listings
- Bulk scan mode (rapid fire, review later)
- GitHub Actions for automated deployment
