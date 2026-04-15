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

**Tests:** `cd api && .venv/bin/pytest -v` (file-based SQLite at `/tmp/bookscan_test.db`, reset per test by the autouse `setup_db` fixture — see BUG-03 note below). `cd frontend && npm run test` (vitest + jsdom).

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
- **Unified color system (CHANGES-16):** one palette across dashboard, edit page, and workflow screens.
  - `navBg` `#E0E0E0` — navbar/footer zones (top/bottom bars on every page)
  - `tableHeaderBg` `#F5F5F5` — table header row + filmstrip background
  - `bg` `#FFFFFF` — content zones (table rows, card content)
  - `rowBorder` `#F0F0F0` — table row separators
  - `zoneBorder` `#CCCCCC` — content zone L/R borders + button borders
  - `primaryBlue` `#0070F3` — primary buttons + active filter state
  - `secondaryText` `#666666` — secondary button text
  - `reviewGreen` `#3B6D11` — "ready to list" check in the review column
  - Legacy `zoneBg`, `controlsBorder`, `footerButtonBg`, `subtle` tokens still exist for workflow screens; `pageBg` was removed in CHANGES-16 (no gray page background anywhere).
- **Primary button** is always inside the `#E0E0E0` footer zone — on dashboard, edit page, and all three workflow screens.
- **Secondary buttons:** white background, `1px solid zoneBorder`, `secondaryText` label.
- **Review toggle buttons** (edit page + Review step, CHANGES-16 FEAT-08, restyled CHANGES-18 FIX-17): three independent buttons — `review metadata`, `review photography`, `review description` — sharing a height with the condition row above. Off: white + `zoneBorder` + `secondaryText`. On: `primaryBlue` fill + no border + white text + `fontWeight 500` + `aria-pressed="true"`. Each saves immediately via `onImmediateSave`.
- **Condition + review button block (CHANGES-18 FIX-17).** Both the Review step and the edit page render two rows of three buttons with identical height (`ROW_BUTTON_HEIGHT = 48`, `lineHeight: 1.15` so two-line labels wrap cleanly). Row 1 is the connected condition segmented bar (Very Good | Good | Acceptable, single-select, no gaps); Row 2 is the three review toggle buttons with an 8px gap (independent, multi-select). Selected state is identical across both rows: `primaryBlue` fill + white text. The third `review description` toggle is always rendered — on the Review step it was previously conditional on the AI summary, but the grid is now always 3 columns so the layout doesn't reflow when Gemini returns.
- **Icons: Lucide line art only — no emoji.** 18px in toolbars, 16px in table cells. In use: `Flashlight`, `Keyboard`, `Camera`, `FileWarning`, `Pencil`, `Trash2`, `Check`, `Filter`, `ChevronDown`.
- **Mobile device detection:** use `isMobileDevice()` from `frontend/src/utils/deviceDetect.ts` (user-agent + `maxTouchPoints > 0`). Do NOT use `useBreakpoint` (viewport width) for this.
- **Spacing:** `WorkflowWrapper` middle flex container handles `gap: 0.75rem` and `padding: 0.75rem 1rem`. Camera views inside workflow steps must NOT add outer padding.
- **Primary button height:** 64px across all workflow screens via `WorkflowWrapper`'s unified footer.

---

## Data Model

**Tables:** `books`, `listings`, `book_photos`. Migrations in `api/alembic/versions/001_initial_schema.py` through `006_replace_data_complete_with_needs_metadata_review.py`.

**`condition`** (VARCHAR 20): `Very Good`, `Good`, `Acceptable` — aligned with eBay's used-book condition scale (CHANGES-18 FIX-18). Legacy `New` / `Poor` values from pre-CHANGES-18 records are retained in the DB but cannot be set via the UI; the edit-page condition row simply shows no button selected for those rows.

**`needs_metadata_review`** (BOOL, migration 006) — replaces `data_complete`. `true` = needs review (inverted semantics from the old field). Auto-computed on `POST /books` ONLY when the payload doesn't explicitly include it: set to `not (has_isbn and title and author and publisher and year)`. `PATCH /books/{id}` never auto-recomputes — treat it as user-managed and only write it when explicitly present.

**`needs_photo_review`** (BOOL, migration 004): separate photography-review flag. Note: the CHANGES-08 spec called this `needs_photography` — same field, no new migration. Always use `needs_photo_review` in code.

**`book_photos`** (migration 003): separate table (not a JSON column) so individual photos are deletable. FK has `ON DELETE CASCADE` + `passive_deletes=True` on the SQLAlchemy relationship — the DB handles cascade, not SQLAlchemy. `has_photos: bool` in responses is an EXISTS subquery in the router, not a column. Book DELETE also `shutil.rmtree`s `/app/photos/{book_id}/`.

**`subject`** was dropped in migration 005. **`data_complete`** was dropped in migration 006.

**Dimensions and weight — data unavailability.** Schema has `dimensions` and `weight` but they are never populated. Open Library, Google Books, and LoC MODS do not carry physical specs. ISBNdb (paid) is the practical future source — see `FUTURE.md`. Until then, blank in all listings.

---

## API Routes

All routes except `/api/login` require `Authorization: Bearer <token>`.

```
POST   /api/login                       GET /api/me
GET    /api/books/lookup/{isbn}         # fetch + merge, no DB write (rate limited)
POST   /api/books                       # save (409 on duplicate ISBN)
GET    /api/books                       # ?page, ?page_size, ?status, ?search
GET/PATCH/DELETE /api/books/{id}        # DELETE → 204
POST/GET  /api/books/{id}/listings
GET    /api/listings                    # ?format=csv for bulk export
POST/GET  /api/books/{id}/photos        # multipart upload / list
GET    /api/books/{id}/photos/download  # ZIP of all photos
DELETE /api/photos/{photo_id}           # 204
GET    /api/photos/{photo_id}/file      # authenticated FileResponse
```

**HTTP 204 on DELETE.** `apiFetch` guards `resp.status === 204` and returns `undefined` rather than calling `resp.json()`.

**`status` query filter (CHANGES-16).** `GET /api/books?status=` accepts a `Literal["all", "needs_metadata_review", "needs_photo_review", "ready"]` — FastAPI returns 422 on unknown values. `ready` filters to `needs_metadata_review == False AND needs_photo_review == False`. Frontend dropdown (`StatusFilter`) also exposes `archived` but it's disabled/grayed and never reaches the server.

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
api/alembic/versions/    001_initial … 006_replace_data_complete
api/tests/               test_auth, test_books, test_lookup, test_listings

frontend/src/
  api/            client, auth, books, listings, photos
  context/        AuthContext
  hooks/          useAuth, useBreakpoint (viewport only), useScanAudio, useCameraStream
  utils/          deviceDetect.ts (isMobileDevice)
  components/
    workflow/     WorkflowWrapper, PhotographStep, LookupStep, ReviewStep
    BookEditCard, PhotoFilmstrip, BookTable, ListingGenerator, StatusFilter
  pages/          LoginPage, PhotoWorkflowPage, DashboardPage
  styles/theme.ts  types.ts

docker-compose.yml        # base (no frontend ports)
docker-compose.dev.yml    # dev overrides (hot reload, port 3001)
docker-compose.prod.yml   # prod overrides (binds 127.0.0.1:3001)
```

---

## Key Gotchas

**iOS viewport pinning — shared `useVisualViewport` hook.** iOS Safari's URL bar and on-screen keyboard shrink the visual viewport without shrinking the layout viewport, so `100vh` and `minHeight: 100vh` both leak footers off-screen. The working pattern is `position: fixed` outer container sized via `useVisualViewport()` (`frontend/src/hooks/useVisualViewport.ts`) — the hook returns `{ height, offsetTop }` tracked via `visualViewport` `resize`/`scroll` listeners, and the outer container applies `height: vpHeight` + `transform: translateY(${vpOffset}px)`. All zones inside use normal flex flow; nothing inside should be `position: fixed`. Scrollable middles must also set `overscroll-behavior: none` to kill the iOS rubber band. **Applied to: WorkflowWrapper, BookEditCard, DashboardPage.** In jsdom `window.visualViewport` is undefined; the hook falls back to `window.innerHeight` + 0 and skips listener attach.

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

**BookEditCard page layout (CHANGES-16, pinning aligned with DashboardPage in CHANGES-18 BUG-04).** Outer container is `position: fixed` sized via `useVisualViewport()` (`height: vpHeight`, `transform: translateY(vpOffset)`) so the navbar and footer stay pinned on iOS Safari through URL-bar and keyboard viewport changes. Flex column, `overflow: hidden`, `overscroll-behavior: none`: (1) **navbar** on `navBg` — BookScan title + book count left, "Edit Book" centered, Log out right; (2) **scrollable content zone**: the scroll container itself is `flex: 1; minHeight: 0; overflowY: auto; overscroll-behavior: none` and **full-width** — the `maxWidth: 1200` / `margin: 0 auto` / `borderLeft`/`borderRight` / white background all live on an INNER wrapper inside the scroll zone, identical to `DashboardPage`. Putting max-width on the scroll container itself (as CHANGES-16 originally did) broke flex sizing on mobile Safari and caused the header/footer to unpin intermittently — BUG-04. (3) **footer** on `navBg`, `flexShrink: 0` — full-width `primaryBlue` `SAVE` button on top, then Dashboard + Generate Listing as equal-width secondary buttons below. The `minHeight: 0` on the scroll container is CRITICAL — without it nested flex scroll breaks on desktop. The old CHANGES-15 card border/radius wrapper is gone; the content zone itself is the white surface. **Field order within the content zone**: filmstrip → Title/Author/Year·Publisher → Condition bar → Review toggle buttons (replaced checkboxes in CHANGES-16) → ISBN/Pages/Publisher → Additional Fields (Edition/Dimensions/Weight) → Description. All text fields use `InlineField`; pending edits accumulate in `DraftFields` and commit together on Save. ISBN is read-only. Condition saves immediately via `onImmediateSave`, as do both review toggles. The Listing generator is triggered via the `onGenerateListing` prop from the footer.

**`needs_metadata_review` auto-compute rules (CHANGES-16).** `POST /books` auto-computes `needs_metadata_review = not (has_isbn and all(title, author, publisher, year))` ONLY when the payload doesn't include it (checked via `payload.model_fields_set`). `PATCH /books/{id}` never auto-recomputes — it writes the field only when explicitly present. This replaces the old `data_complete` field (migration 006 drops the old column). Semantics are inverted: `true` now means "needs review".

**PhotoFilmstrip.** Shared component. Cover first (leftmost, 2px accent border, not deletable); user photos follow with gray ✕ delete (subtle fill, border, muted ✕ — not red). The + add tile is borderless: bare 22px + character, no dotted rectangle. API: `coverUrl`, `photos: Array<{key, url}>`, `onDelete`, optional `onAddPhoto`. Stable UUID keys via `crypto.randomUUID()`.

**Dashboard polling.** `DashboardPage` polls `GET /api/books` every 3s, paused when tab hidden (`visibilitychange`). No WebSocket.

**Dashboard layout (CHANGES-16, navbar buttons CHANGES-18 FIX-16).** Full-viewport flex column: `navBg` navbar → white content zone with `zoneBorder` L/R borders (`maxWidth: 1200`, search + `StatusFilter`, then `<BookTable>`, then pagination) → `navBg` footer with "N of M records" centered. **Navbar right side is context-aware:** `isMobileDevice()` → `Camera` scan icon that navigates to `/scan`; desktop → `CSV` export button. Log out button sits to the right of whichever of the two is rendered. The old in-toolbar CSV button was removed — there is one CSV entry point on desktop and none on mobile. No gray page background. Media queries (`max-width: 767px`) still hide author/publisher/year on mobile. Row tap navigates to edit; action buttons `stopPropagation` to prevent double-fire. `DashboardPage` also reads `location.state.editBookId` on mount and, if present, fetches that book and opens the edit view — used by the duplicate-ISBN flow in `LookupStep`.

**StatusFilter dropdown (CHANGES-16 FEAT-05, border colors CHANGES-18 FIX-15).** `frontend/src/components/StatusFilter.tsx`. Compact button showing `Filter` + `ChevronDown` icons (no text label). Border color tracks the active filter: `#BA7517` (metadata review amber) / `#0070F3` (photography blue) / `#7F77DD` (description purple) / `#CCCCCC` (default gray) for `all` and the disabled `archived`. Dropdown options: All records / Needs metadata review / Needs photography / Needs description review / Ready to list / Archived (grayed, disabled). The active selection writes a `status` query param to `listBooks`; `archived` is defensively mapped to `'all'` at the call site and never reaches the server.

**Dashboard table styling (CHANGES-16).** Outer wrapper is just `overflow-x: auto` — the content zone provides L/R borders. Header row: `tableHeaderBg` (`#F5F5F5`) with lowercase labels (`review`, `title`, `author`, `publisher`, `year`, `actions`). Body rows: white background, `rowBorder` (`#F0F0F0`) bottom separators, row height adjusts naturally. **Review column** is a single centered column: green `Check` in `reviewGreen` when `!needs_metadata_review && !needs_photo_review`; otherwise a vertical stack of amber `FileWarning` (when `needs_metadata_review`) and/or blue `Camera` (when `needs_photo_review`). **Actions column** is icon-only on both desktop and mobile: unbordered `Pencil` + `Trash2` at `#888`. The Listing button was removed from every row in CHANGES-16; Generate Listing now only exists in the edit-page footer.

**Mobile scroll suppression.** `overflow-x: hidden` + `overscroll-behavior-y: none` on `html`/`body` in `index.html`. `WorkflowWrapper` outer container sets `maxWidth: '100vw'` and `overscrollBehavior: 'none'`.

**Haptic feedback.** Key events call `navigator.vibrate?.(25)`. iOS/Safari (all iOS browsers — Apple forces WebKit) doesn't support Web Vibration; the optional chain is a silent no-op. Android Chrome supports it. iOS absence is not a bug.

---

## AI Summaries (CHANGES-17)

When a book lookup returns no `description` (none of Open Library / Google Books / LoC have one), `PhotoWorkflowPage` fires a **lookup-time** Gemini call in parallel with entering the Review step, so the description is available as soon as Review mounts. The result is held in memory until SAVE; the final POST to `/api/books` carries `description` + `description_source: 'ai_generated'` in a single round trip — no background task, no polling.

- **Service:** `api/app/services/ai_summary.py`
- **Model:** `gemini-2.5-flash` (constant `GEMINI_MODEL`)
- **Free tier:** 10 RPM / 500 RPD / 250K TPM — well within ~1 request per scan.
- **Timeout:** 8 seconds.
- **Token budget:** `MAX_OUTPUT_TOKENS = 400` AND `thinkingConfig.thinkingBudget = 0` — Gemini 2.5 Flash counts internal "thinking" tokens against the output budget; without disabling thinking the visible reply gets truncated to ~4 tokens. Both knobs are required.
- **Skipped when:** lookup already returned a description, or `lookupResult.title` is null (no usable metadata), or `GEMINI_API_KEY` is unset (endpoint returns `{description: null}`).

**Frontend flow.** `PhotoWorkflowPage.handleLookupComplete` calls `generateSummary({title, author, year, publisher})` immediately after the lookup resolves, sets `aiSummary = {status: 'pending', text: null}` synchronously, and updates to `success` / `failed` on response. A monotonic `aiGenIdRef` token discards stale responses if the user cancels mid-flight. `ReviewStep` reads `aiSummary` via prop and renders: pending → italic "Generating summary…", success → real text + 3rd toggle (already ON), failed → italic "Summary unavailable" line (no retry button this iteration).

**Backend endpoints:**
- `POST /api/books/generate-summary` (rate limited 20/min, auth required) — stateless Gemini call, no DB writes. Takes `SummaryRequest{title, author, year, publisher}`, returns `SummaryResponse{description: str | null}`. Returns null on missing API key, 429, timeout, or any failure — the caller treats null as "fall back to no description". This is the path the workflow uses.
- `POST /api/books` still has the BackgroundTasks safety-net wiring for non-workflow paths (manual API calls, future flows): if the POST has no `description` AND `GEMINI_API_KEY` is set, it schedules `generate_and_store_summary` to populate it asynchronously. The frontend workflow bypasses this by sending `description` in the POST.
- `generate_and_store_summary(book_id)` — opens its own `async_session_maker()`, never touches the request session, mirroring the cover-download pattern. Used only by the background safety net.

**Database fields (migration 007):**
- `description_source` VARCHAR(32) — one of `open_library | google_books | library_of_congress | ai_generated | manual`, or NULL. The frontend sends `'ai_generated'` in the POST when the AI succeeded. The edit page sends `'manual'` when the user manually edits the description text. The backend auto-derives from `data_sources['description']` only when the caller didn't provide a value.
- `needs_description_review` BOOL default false — set true when an AI summary is included in the POST; user toggles off when satisfied. Drives the dashboard review column (purple Sparkles icon, `aiPurple` `#7F77DD`) and the `?status=needs_description_review` filter.
- `description_generation_failed` BOOL default false — set on timeout, 4xx/5xx, empty response, or repeated 429 (only when the legacy background-task path runs; the lookup-time path doesn't write this field, since failure surfaces as `aiSummary.status === 'failed'` in the in-memory state). Logged server-side. Not surfaced in the UI in this iteration; a retry UI is deferred.

**`?status=needs_description_review`** is a `Literal` value on `GET /api/books`. The `ready` filter requires all three review flags (`needs_metadata_review`, `needs_photo_review`, `needs_description_review`) to be false.

**Three review toggles (Review step + edit page).** `ReviewStep` and `BookEditCard` both render review toggles as styled buttons with `aria-pressed` (no checkboxes). The Review step shows a 2-column grid until the AI summary arrives, then expands to 3 columns. The edit page is always 3 columns. Description edits on the edit page send `description_source: 'manual'` in the PATCH so the Sparkles icon disappears.

**Reliability (CHANGES-18 BUG-01).** `generate_summary_text` now retries once on 5xx / network errors with a 500ms backoff and a tighter 3.5s per-attempt timeout (total ~7.5s, still inside the frontend's 8s budget). Gemini 2.5 Flash intermittently returns 503 "high demand" during normal use and a single retry rescues most of those calls. The ReviewStep failure-state message no longer redirects the user to the edit page — it just says "Summary unavailable" — since the feature is supposed to generate inline, not punt.

**Duplicate ISBN handling (CHANGES-18 BUG-02).** `GET /api/books/lookup/{isbn}` consults the `books` table and returns `existing_book_id: UUID | None` alongside the metadata. When the frontend sees `existing_book_id` set, `LookupStep` does NOT call `onLookupComplete` — it surfaces a "This book is already in your library" panel with an "Open existing record" button that `navigate('/dashboard', { state: { editBookId } })`s to the dashboard. `DashboardPage` picks that state up on mount, calls `getBook(id)`, opens `editingBook`, and clears the location state so a browser refresh doesn't re-trigger it. The Review step is never entered for duplicates, so no Gemini call is fired and no 409 save error is shown.

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
