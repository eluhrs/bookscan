# BookScan — CLAUDE.md

Scan book ISBNs with a phone camera, look up metadata from public APIs, store in PostgreSQL, generate eBay listing text.

Historical iterations: `docs/HISTORY.md`. Deferred items: `FUTURE.md`.

---

## Conventions
- Never join shell commands with `&&` — run each as a separate tool call so failures are isolated and individually approvable.

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

Nginx proxies `/api/*` to FastAPI — one domain, no CORS. PostgreSQL is Docker-internal only. Metadata APIs are called server-side only.

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
# Start dev (hot reload, api + frontend)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Run migrations (required on first start or schema change)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api alembic upgrade head

# Stop
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

**Dev ports:** `https://localhost:3001` serves the app (Vite + mkcert). `http://localhost:3000` 301-redirects via the `httpRedirect` plugin in `vite.config.ts`. On prod, Apache handles both protocols.

**mkcert certs:** `frontend/localhost+1.pem` / `localhost+1-key.pem` cover `localhost`, `127.0.0.1`, `bloke.local`. Regenerate: `cd frontend && mkcert localhost 127.0.0.1 bloke.local && mv localhost+2.pem localhost+1.pem && mv localhost+2-key.pem localhost+1-key.pem`.

**Phone access:** same-subnet → `https://bloke.local:3001`. Split-subnet → `https://<mac-ip>:3001` + accept cert.

**Tests:** `cd api && .venv/bin/pytest -v` (in-memory SQLite). `cd frontend && npm run test` (vitest + jsdom).

---

## Environment Variables

`.env` in project root. Never commit.

```
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
SECRET_KEY       # openssl rand -hex 32
APP_USERNAME
PASSWORD_HASH    # cd api && .venv/bin/python generate_hash.py '<password>'
```

**`$$` escaping.** Compose interpolates `$` in `env_file` values, so bcrypt hashes must have each `$` doubled. `generate_hash.py` outputs the escaped form — paste directly; the container receives the correct `$2b$12$...`.

---

## Auth

Single-user: `APP_USERNAME` + `PASSWORD_HASH` from `.env`. Verified with `bcrypt.checkpw()` (passlib removed — incompatible with bcrypt ≥ 4.0.0). JWT via python-jose, 1-week expiry. All routes protected except `POST /api/login`. slowapi rate limiting, stricter on `/api/books/lookup/{isbn}`.

---

## Design Conventions

- **Button labels (workflow screens):** primary buttons ALL CAPS (`CAPTURE`, `LOOKUP`, `SAVE`, `SKIP`); hint text Title Case (`tap Capture`).
- **Colors are tokens.** All colors reference `theme.colors.*` from `frontend/src/styles/theme.ts`. No hardcoded hex in components.
- **Color zones (workflow):** content `surface` (`#FFFFFF`); header/footer `zoneBg` (`#E0E0E0`); footer buttons `footerButtonBg` (`#FFFFFF`) + `1px solid controlsBorder` (`#CCCCCC`). Toolbar buttons use `subtle` (`#F4F4F4`) fill with same border — no container border around the toolbar row.
- **Controls bar:** `1px solid controlsBorder`; interactive controls get `background: subtle`.
- **Secondary button bar:** `zoneBg`. Second button is "Start Over" (not "Cancel").
- **Icons: Lucide line art only — no emoji.** 18px in toolbars, 16px in table cells. In use: `Flashlight`, `Keyboard`, `Camera`, `FileWarning`, `Pencil`, `Trash2`, `Check`.
- **Mobile device detection:** use `isMobileDevice()` from `frontend/src/utils/deviceDetect.ts` (user-agent + `maxTouchPoints > 0`). Do NOT use `useBreakpoint` (viewport width) for this.
- **Spacing:** `WorkflowWrapper` middle flex container handles `gap: 0.75rem` and `padding: 0.75rem 1rem`. Camera views inside workflow steps must NOT add outer padding.
- **Primary button height:** 64px across all workflow screens via `WorkflowWrapper` Zone 5.

---

## Data Model

**Tables:** `books`, `listings`, `book_photos`. Migrations in `api/alembic/versions/001_initial_schema.py` through `005_drop_subject.py`.

**`condition`** (VARCHAR 20): `New`, `Very Good`, `Good`, `Acceptable`, `Poor`.

**`data_complete`** = true when title, author, publisher, year, and isbn are all present. Also used as the "flag for review" target — setting it false on save preserves an explicit override.

**`needs_photo_review`** (BOOL, migration 004): separate photography-review flag. Note: the CHANGES-08 spec called this `needs_photography` — same field, no new migration. Always use `needs_photo_review` in code.

**`book_photos`** (migration 003): separate table (not a JSON column) so individual photos are deletable. FK has `ON DELETE CASCADE` + `passive_deletes=True` on the SQLAlchemy relationship — the DB handles cascade, not SQLAlchemy. `has_photos: bool` in responses is an EXISTS subquery in the router, not a column. Book DELETE also `shutil.rmtree`s `/app/photos/{book_id}/`.

**`subject`** was dropped in migration 005.

**Dimensions and weight — data unavailability.** Schema has `dimensions` and `weight` but they are never populated. Open Library, Google Books, and LoC MODS do not carry physical specs. ISBNdb (paid) is the practical future source — see `FUTURE.md`. Until then, blank in all listings.

---

## API Routes

All routes except `/api/login` require `Authorization: Bearer <token>`.

```
POST   /api/login                       GET /api/me
GET    /api/books/lookup/{isbn}         # fetch + merge, no DB write (rate limited)
POST   /api/books                       # save (409 on duplicate ISBN)
GET    /api/books                       # ?page, ?page_size, ?incomplete_only, ?search
GET/PATCH/DELETE /api/books/{id}        # DELETE → 204
POST/GET  /api/books/{id}/listings
GET    /api/listings                    # ?format=csv for bulk export
POST/GET  /api/books/{id}/photos        # multipart upload / list
GET    /api/books/{id}/photos/download  # ZIP of all photos
DELETE /api/photos/{photo_id}           # 204
GET    /api/photos/{photo_id}/file      # authenticated FileResponse
```

**HTTP 204 on DELETE.** `apiFetch` guards `resp.status === 204` and returns `undefined` rather than calling `resp.json()`.

---

## Metadata Merge Priority

| Field | Priority |
|---|---|
| title, author | Open Library → Google Books → LoC |
| publisher, edition, year | LoC → Open Library → Google Books |
| description | Google Books → Open Library → LoC |
| cover_image_url | Open Library → Google Books |
| pages | first non-null wins |

Description is rarely populated — sourced from Google Books only (OL fetcher never extracts it; OL Works endpoint not called).

**ISBN barcodes only.** The scanner reads any barcode. Only `978`/`979` prefixes are book ISBNs — other barcodes return empty metadata.

---

## Project Structure

```
api/app/
  main.py  config.py  database.py  auth.py  models.py  schemas.py
  routers/     books.py  listings.py  photos.py
  services/    lookup.py  covers.py
api/alembic/versions/    001_initial … 005_drop_subject
api/tests/               test_auth, test_books, test_lookup, test_listings

frontend/src/
  api/            client, auth, books, listings, photos
  context/        AuthContext
  hooks/          useAuth, useBreakpoint (viewport only), useScanAudio, useCameraStream
  utils/          deviceDetect.ts (isMobileDevice)
  components/
    workflow/     WorkflowWrapper, PhotographStep, LookupStep, ReviewStep
    BookEditCard, PhotoFilmstrip, BookTable, ListingGenerator
  pages/          LoginPage, PhotoWorkflowPage, DashboardPage
  styles/theme.ts  types.ts

docker-compose.yml        # base (no frontend ports)
docker-compose.dev.yml    # dev overrides (hot reload, port 3001)
docker-compose.prod.yml   # prod overrides (binds 127.0.0.1:3001)
```

---

## Key Gotchas

**iOS keyboard + WorkflowWrapper.** `position: fixed` on child zones does not stay visible when the iOS Safari keyboard opens — iOS repositions fixed elements relative to the layout viewport. Working approach: the outer container is `position: fixed`; its `height` and `transform: translateY()` track `window.visualViewport.height` and `.offsetTop` via `visualViewport` `resize`/`scroll` listeners. All zones inside use normal flex flow. In jsdom, `visualViewport` is undefined; the `if (!vv) return` guard handles it.

**Docker Compose dev override strips migrations.** `docker-compose.dev.yml` overrides the CMD to uvicorn `--reload`, skipping the `alembic upgrade head` baked into the prod Dockerfile CMD. Run migrations manually after first start or schema changes.

**Port mapping conflict.** Base `docker-compose.yml` has no `ports:` on the frontend service — only dev/prod overrides declare them. Adding `ports:` to the base file makes Compose merge both mappings and neither binds.

**Vite proxy target.** `vite.config.ts` proxies `/api` to `http://api:8001` (Docker service name), not `localhost`.

**Cover download uses its own DB session.** The background task opens a fresh `async_session_maker()` — the request-scoped session is closed by the time it runs.

**Manual barcode scanning — do not simplify.** Reliability combines: (1) `getUserMedia` with `{ width: { ideal: 1920 }, height: { ideal: 1080 } }`; (2) 3-strategy multi-crop decode per press — center 80%×40% 1:1, wide 95%×25%, and 50%×30% stretched 2× digitally; (3) torch toggle via `applyConstraints({ advanced: [{ torch: true }] })` when `track.getCapabilities().torch`; (4) dark targeting mask. Library is `@zxing/browser` 0.1.x — no `reset()`; cleanup stops tracks directly via `videoRef.current.srcObject`. Hard-won; don't collapse.

**Torch state persistence.** Module-level `let persistedTorchOn = false` in `useCameraStream.ts`. `useState(persistedTorchOn)` initializes on each mount; `handleTorchToggle` writes to it before `applyConstraints`. New stream start re-fires `applyConstraints({ torch: true })` if persisted. Cleanup does NOT reset state or turn torch off — `t.stop()` powers it down physically. Do not add `applyConstraints({ torch: false })` to cleanup; it races with `t.stop()`.

**Camera health + recovery.** `useCameraStream` samples a 16×16 canvas every 2s (luminance < 5 = black frame), listens for `'ended'` on the track and `visibilitychange`. A `restartRef` lets async handlers call the current `startStream` closure. Recovery is silent. `retryCamera()` is exposed so PhotographStep/LookupStep can show a retry button on errors.

**useCameraStream `cancelled` flag.** Inside the effect body, prevents a race where `getUserMedia` resolves after unmount — the `.then()` checks `cancelled` and stops the stale stream.

**Scan audio.** `useScanAudio` uses Web Audio API. `AudioContext` is lazy-created on first button press (mobile user-gesture). It calls `ctx.resume().then(schedule)` so tones play after `await lookupIsbn()`. Do NOT `ctx.close()` on cleanup — it cuts off the save chime when `ReviewStep` unmounts after save.

**Cancel guard in PhotoWorkflowPage.** `stepRef` tracks the current step synchronously. `handleLookupComplete` bails if `stepRef.current !== 'lookup'`, preventing an in-flight lookup response from overriding a Start Over press.

**Photo workflow.** Photograph → Lookup → Review → Confirmation. Photos held in memory as `File` objects; uploaded via `POST /api/books/{id}/photos` after book creation. Stored at `/app/photos/{book_id}/{photo_id}.jpg` in the `photos` Docker volume (declared in both base and dev compose). On upload failure, `PhotoWorkflowPage` stores `savedBookId` and `ReviewStep` retries only the upload on re-tap of SAVE.

**Save confirmation overlay.** After save, `PhotoWorkflowPage` transitions to a `'confirmation'` step (in the `WorkflowStep` union) that shows a full-screen Check for 800ms. `playSuccess()` fires in the `useEffect` handling `'confirmation'`, not in `ReviewStep`.

**PhotographStep capture.** `useCameraStream` + Canvas: draw frame, resize to max 1200px, encode JPEG @ 85%, wrap in `File`. Photo count (0–5) persists in localStorage; 0 hides progress indicators and relabels the button `SKIP`. `LookupStep` passes `enabled: mode === 'camera'` to shut off the stream in keyboard mode.

**Blob URLs for photos.** Dashboard fetches each via `GET /api/photos/{id}/file` (authenticated) and renders as blob URL. Revoked on edit-view close.

**BookEditCard inline editing.** Anchored fullscreen layout (visualViewport pattern, mirrors `WorkflowWrapper`). Header zone (`zoneBg`): pill-shaped Back button (chevron + "Back") + "Edit Book" title, calls `onBack` prop. Filmstrip flush below header. Scrollable content zone in the middle (max-width 560px centered). Footer zone (`zoneBg`): "added {date}" left, Save button right. Same layout desktop and mobile. All text fields use `InlineField`: hover shows 0.5px border, click → input/textarea, blur → display. Pending edits accumulate in `DraftFields` and commit together on Save. ISBN is read-only (unique key, not patchable). Condition is a 5-button segmented bar (`ConditionBar`) — saves immediately via `onImmediateSave`, no dropdown. Checkboxes (Review Metadata?, Review Photography?) live in a single bordered container, save immediately via `onImmediateSave`. Empty fields display as `—`. The Listing generator is no longer triggered from inside the card — only from BookTable rows.

**PhotoFilmstrip.** Shared component. Cover first (leftmost, 2px accent border, not deletable); user photos follow with gray ✕ delete (subtle fill, border, muted ✕ — not red). The + add tile is borderless: bare 22px + character, no dotted rectangle. API: `coverUrl`, `photos: Array<{key, url}>`, `onDelete`, optional `onAddPhoto`. Stable UUID keys via `crypto.randomUUID()`.

**Dashboard polling.** `DashboardPage` polls `GET /api/books` every 3s, paused when tab hidden (`visibilitychange`). No WebSocket.

**Mobile dashboard.** Media queries (`max-width: 767px`) hide author/publisher/year. Text action buttons become Lucide `Pencil`/`Trash2`. Row tap navigates to edit; action buttons `stopPropagation` to prevent double-fire. Toolbar fits on one line on mobile: search ("Search books..."), "Incomplete" checkbox, "CSV" button — search shrinks via `flex: 1; minWidth: 0`, the other two `flexShrink: 0`.

**Dashboard table styling.** Header row uses `zoneBg` (#E0E0E0) background with all-lowercase labels (`review`, `title`, `author`, `publisher`, `year`, `actions`). The leftmost "review" column shows: a single small green Lucide `Check` when both `data_complete` is true AND `needs_photo_review` is false; otherwise the familiar two-slot grid with amber `FileWarning` (when `!data_complete`) and/or blue `Camera` (when `needs_photo_review`). Title and publisher columns truncate single-line with ellipsis (matching author).

**Mobile scroll suppression.** `overflow-x: hidden` + `overscroll-behavior-y: none` on `html`/`body` in `index.html`. `WorkflowWrapper` outer container sets `maxWidth: '100vw'` and `overscrollBehavior: 'none'`.

**Haptic feedback.** Key events call `navigator.vibrate?.(25)`. iOS/Safari (all iOS browsers — Apple forces WebKit) doesn't support Web Vibration; the optional chain is a silent no-op. Android Chrome supports it. iOS absence is not a bug.

---

## Deploying to Hetzner

```bash
# On the server
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api alembic upgrade head
```

**Important:** always include `-f docker-compose.prod.yml`. Without it the frontend port is not mapped and Apache returns 503. Prod override binds the frontend to `127.0.0.1:3001` (localhost only).

Apache VirtualHost:
```apache
<VirtualHost *:443>
    ServerName bookscan.luhrs.net
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
</VirtualHost>
```
