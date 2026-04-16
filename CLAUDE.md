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

Single-user: `APP_USERNAME` + `PASSWORD_HASH` from `.env`. Verified with `bcrypt.checkpw()` (passlib removed — incompatible with bcrypt ≥ 4.0.0). JWT via python-jose, 12-hour sliding expiry (CHANGES-21). All routes protected except `POST /api/login`. slowapi rate limiting, stricter on `/api/books/lookup/{isbn}`.

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
- **Icons: Lucide line art only — no emoji.** 18px in toolbars, 16px in table cells. In use: `Flashlight`, `Keyboard`, `Camera`, `FileWarning`, `Pencil`, `Trash2`, `Check`, `Filter`, `ChevronDown`, `Download`, `X`.
- **Mobile device detection:** use `isMobileDevice()` from `frontend/src/utils/deviceDetect.ts` (user-agent + `maxTouchPoints > 0`). Do NOT use `useBreakpoint` (viewport width) for this.
- **Spacing:** `WorkflowWrapper` middle flex container handles `gap: 0.75rem` and `padding: 0.75rem 1rem`. Camera views inside workflow steps must NOT add outer padding.
- **Primary button height:** 64px across all workflow screens via `WorkflowWrapper`'s unified footer.

---

## Data Model

**Tables:** `books`, `listings`, `book_photos`, `export_batches`. Migrations in `api/alembic/versions/001_initial_schema.py` through `009_create_export_batches.py`.

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
POST   /api/exports                    # eBay ZIP export (CSV + photos) + auto-archive
GET    /api/exports/batch              # latest export batch (for undo banner)
POST   /api/exports/batch/undo         # undo last export (unarchive books)
DELETE /api/exports/batch              # dismiss banner (204)
```

**HTTP 204 on DELETE.** `apiFetch` guards `resp.status === 204` and returns `undefined` rather than calling `resp.json()`.

**`status` + `review` query filters (CHANGES-22).** `GET /api/books` accepts two independent query params: `status` (`Literal["all", "ready", "archived"]`, default `"all"`) and `review` (`Optional[Literal["needs_metadata_review", "needs_photo_review", "needs_description_review", "needs_price"]]`, default `None`). Both are combinable — the backend applies both WHERE clauses to return the intersection. `ready` filters to `archived == False AND needs_metadata_review == False AND needs_photo_review == False AND needs_description_review == False AND price IS NOT NULL AND price > 0`. `archived` filters to `archived == True`. `needs_price` filters to `price IS NULL OR price <= 0`.

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
  routers/     books.py  listings.py  photos.py  exports.py
  services/    lookup.py  covers.py
api/alembic/versions/    001_initial … 006_replace_data_complete
api/tests/               test_auth, test_books, test_lookup, test_listings, test_exports

frontend/src/
  api/            client, auth, books, listings, photos, exports
  context/        AuthContext
  hooks/          useAuth, useBreakpoint (viewport only), useScanAudio, useCameraStream
  utils/          deviceDetect.ts (isMobileDevice)
  components/
    workflow/     WorkflowWrapper, PhotographStep, LookupStep, ReviewStep
    BookCard, PhotoFilmstrip, BookTable, ListingGenerator, StatusFilter
  pages/          LoginPage, PhotoWorkflowPage, DashboardPage
  styles/theme.ts  types.ts

docker-compose.yml        # base (no frontend ports)
docker-compose.dev.yml    # dev overrides (hot reload, port 3001)
docker-compose.prod.yml   # prod overrides (binds 127.0.0.1:3001)
```

---

## Key Gotchas

**iOS viewport pinning — shared `useVisualViewport` hook.** iOS Safari's URL bar and on-screen keyboard shrink the visual viewport without shrinking the layout viewport, so `100vh` and `minHeight: 100vh` both leak footers off-screen. The working pattern is `position: fixed` outer container sized via `useVisualViewport()` (`frontend/src/hooks/useVisualViewport.ts`) — the hook returns `{ height, offsetTop }` tracked via `visualViewport` `resize`/`scroll` listeners, and the outer container applies `height: vpHeight` + `transform: translateY(${vpOffset}px)`. All zones inside use normal flex flow; nothing inside should be `position: fixed`. Scrollable middles must also set `overscroll-behavior: none` to kill the iOS rubber band. **Applied to: WorkflowWrapper, DashboardPage (edit view shell).** In jsdom `window.visualViewport` is undefined; the hook falls back to `window.innerHeight` + 0 and skips listener attach.

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

**Edit page layout (CHANGES-20 — now lifted into `DashboardPage`, wrapping shared `BookCard`).** Outer container in `DashboardPage`'s edit branch is `position: fixed` sized via `useVisualViewport()` (`height: vpHeight`, `transform: translateY(vpOffset)`). Flex column, `overflow: hidden`, `overscroll-behavior: none`: (1) **navbar** on `navBg` — BookScan title + book count left, "Edit Book" centered, Log out right; (2) **scrollable content zone**: the scroll container itself is `flex: 1; minHeight: 0; overflowY: auto; overscroll-behavior: none` and **full-width** — the `maxWidth: 1200` / `margin: 0 auto` / `borderLeft`/`borderRight` / white background all live on an INNER wrapper inside the scroll zone. This pattern (BUG-04) was originally introduced for BookEditCard and survived its deletion. (3) **footer** on `navBg`, `flexShrink: 0` — full-width `primaryBlue` `SAVE` button on top, then Dashboard + Generate Listing as equal-width secondary buttons below. The `minHeight: 0` on the scroll container is CRITICAL for nested flex scroll. Inside the inner wrapper, `DashboardPage` renders `<BookCard editable ref={bookCardRef} …/>` — all field editing happens inside `BookCard`. SAVE click calls `bookCardRef.current?.commitDraft()` which flushes `BookCard`'s local `DraftFields` through `onSave`. Condition + review toggles still save immediately via `onImmediateSave`.

**`needs_metadata_review` auto-compute rules (CHANGES-16).** `POST /books` auto-computes `needs_metadata_review = not (has_isbn and all(title, author, publisher, year))` ONLY when the payload doesn't include it (checked via `payload.model_fields_set`). `PATCH /books/{id}` never auto-recomputes — it writes the field only when explicitly present. This replaces the old `data_complete` field (migration 006 drops the old column). Semantics are inverted: `true` now means "needs review".

**PhotoFilmstrip.** Shared component. Cover first (leftmost, 2px accent border, not deletable); user photos follow with gray ✕ delete (subtle fill, border, muted ✕ — not red). The + add tile is borderless: bare 22px + character, no dotted rectangle. API: `coverUrl`, `photos: Array<{key, url}>`, `onDelete`, optional `onAddPhoto`. Stable UUID keys via `crypto.randomUUID()`.

**Dashboard polling.** `DashboardPage` polls `GET /api/books` every 3s, paused when tab hidden (`visibilitychange`). No WebSocket.

**Dashboard layout (CHANGES-16, navbar buttons CHANGES-18 FIX-16).** Full-viewport flex column: `navBg` navbar → white content zone with `zoneBorder` L/R borders (`maxWidth: 1200`, search + `StatusFilter`, then `<BookTable>`, then pagination) → `navBg` footer with "N of M records" centered. **Navbar right side is context-aware:** `isMobileDevice()` → `Camera` scan icon that navigates to `/scan`; desktop → `CSV` export button. Log out button sits to the right of whichever of the two is rendered. The old in-toolbar CSV button was removed — there is one CSV entry point on desktop and none on mobile. No gray page background. Media queries (`max-width: 767px`) still hide author/publisher/year on mobile. Row tap navigates to edit; action buttons `stopPropagation` to prevent double-fire. `DashboardPage` also reads `location.state.editBookId` on mount and, if present, fetches that book and opens the edit view — used by the duplicate-ISBN flow in `LookupStep`.

**Dashboard filters (CHANGES-22 FEAT-01, replaces CHANGES-16 FEAT-05).** `frontend/src/components/StatusFilter.tsx` exports two independent filter components: `StatusTagFilter` (Lucide `Tag` + chevron, options: All records / Ready to list / Archived) and `ReviewEyeFilter` (Lucide `Eye` + chevron, options: No filter / Metadata Review / Photography Review / Description Review / Price). Both share a generic `FilterButton<V>` shell. Active states use colored ring + fill matching the filter's semantic lane. Both write independent query params (`status` and `review`) to `listBooks()`. Type exports: `StatusTagValue`, `ReviewEyeValue`.

**Dashboard table styling (CHANGES-16).** Outer wrapper is just `overflow-x: auto` — the content zone provides L/R borders. Header row: `tableHeaderBg` (`#F5F5F5`) with lowercase labels (`review`, `title`, `author`, `publisher`, `year`, `actions`). Body rows: white background, `rowBorder` (`#F0F0F0`) bottom separators, row height adjusts naturally. **Review column** is a single centered column: green `Check` in `reviewGreen` when `!needs_metadata_review && !needs_photo_review`; otherwise a vertical stack of amber `FileWarning` (when `needs_metadata_review`) and/or blue `Camera` (when `needs_photo_review`). **Actions column** is icon-only on both desktop and mobile: unbordered `Pencil` + `Trash2` at `#888`. The Listing button was removed from every row in CHANGES-16; Generate Listing now only exists in the edit-page footer.

**Mobile scroll suppression.** `overflow-x: hidden` + `overscroll-behavior-y: none` on `html`/`body` in `index.html`. `WorkflowWrapper` outer container sets `maxWidth: '100vw'` and `overscrollBehavior: 'none'`.

**Haptic feedback.** Key events call `navigator.vibrate?.(25)`. iOS/Safari (all iOS browsers — Apple forces WebKit) doesn't support Web Vibration; the optional chain is a silent no-op. Android Chrome supports it. iOS absence is not a bug.

---

## AI Summaries (CHANGES-17 — details in `docs/HISTORY.md`)

**Core flow.** When a lookup returns no `description`, `PhotoWorkflowPage.handleLookupComplete` fires `generateSummary()` in parallel with entering Review. `aiSummary = {status: 'pending' | 'success' | 'failed', text}` is held in memory; a monotonic `aiGenIdRef` discards stale responses. On SAVE the final POST to `/api/books` carries `description` + `description_source: 'ai_generated'` in one round trip — no background task, no polling.

**Gemini config (non-obvious).** Model `gemini-2.5-flash-lite`. **Do not change the model string** unless explicitly instructed — see CHANGES-19 for the quota investigation. Frontend timeout 8s; backend retry logic (CHANGES-20): 2 attempts total, 3.5s per-attempt httpx timeout, 500ms backoff on 5xx / network / empty candidates. 429 raises `GeminiRateLimitError` immediately so the background-task caller can schedule a 60s retry. `MAX_OUTPUT_TOKENS = 400` AND `thinkingConfig.thinkingBudget = 0` are both required — without disabling thinking, the visible reply is truncated because Gemini 2.5 counts internal thinking tokens against the output budget. On any failure the backend logs the model name + HTTP status + first 500 chars of the response body + attempt number so quota/safety-block issues are immediately visible in `docker compose logs api`. If generation starts failing with quota errors, the fix is to enable billing on the Google Cloud project — no code change needed.

**Skipped when** lookup already returned a description, or `lookupResult.title` is null, or `GEMINI_API_KEY` is unset.

**Endpoints.** `POST /api/books/generate-summary` (20/min, auth required) is stateless and returns null on any failure — the workflow path. `POST /api/books` still has a `BackgroundTasks` safety-net (`generate_and_store_summary`) for non-workflow callers; it opens its own `async_session_maker()`.

**DB fields (migration 007).** `description_source` VARCHAR(32); `needs_description_review` BOOL; `description_generation_failed` BOOL (set only by the legacy background-task path — the lookup-time path surfaces failure as `aiSummary.status === 'failed'`). `?status=needs_description_review` is a `Literal` on `GET /api/books`; the `ready` filter requires all three review flags to be false.

**Duplicate ISBN handling (CHANGES-18 BUG-02).** `GET /api/books/lookup/{isbn}` returns `existing_book_id: UUID | None`. When set, `LookupStep` shows "This book is already in your library" and an "Open existing record" button that `navigate('/dashboard', { state: { editBookId } })`. `DashboardPage` picks up location state on mount, opens the edit view, then clears the state so refresh doesn't re-trigger. Review step is never entered for duplicates — no Gemini call, no 409.

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

---

## CHANGES-22 additions

**FEAT-01 — Dashboard filter redesign.** The single `StatusFilter` dropdown (Filter icon) was replaced by two independent icon-button controls in `frontend/src/components/StatusFilter.tsx`: `StatusTagFilter` (Lucide `Tag` icon, options: All records / Ready to list / Archived) and `ReviewEyeFilter` (Lucide `Eye` icon, options: No filter / Metadata Review / Photography Review / Description Review / Price). Both are combinable — selecting one does not clear the other. Active states use colored ring + fill: green for Ready, gray for Archived/Price, amber for Metadata, blue for Photography, purple for Description. Backend `GET /api/books` now accepts two independent query params: `status` (`all`/`ready`/`archived`) and `review` (`needs_metadata_review`/`needs_photo_review`/`needs_description_review`/`needs_price`). Footer shows active filter labels.

**FEAT-02 — Price indicator in review column.** Gray `DollarSign` icon (`#888`) appears in the BookTable review column when `price` is null or zero. Stacks vertically with existing review icons. Green check now requires all three review flags false AND price > 0.

**FEAT-03 — Price and category on desktop edit.** `PriceCategoryRow` component in `BookCard.tsx` renders a 2-column grid (50/50) below the review toggles. Controlled by `showListingFields` prop — only passed as `true` on desktop via `!isMobileDevice()`. Price: tap to edit inline, saves on blur via `onImmediateSave`. Category: dropdown with 9 options (Science Fiction, History, Science, Social Sciences, Philosophy, Travel, Textbooks & Education, Antiquarian & Collectible, Other), saves on selection. Visual: unset = white bg + gray text; set = `primaryBlue` bg + white text. Category shows Lucide `Check` when set (not category name). Generate Listing button removed from edit footer; footer is now SAVE + Dashboard only.

**FEAT-04 — Archived filter logic.** `status=all` shows everything including archived. `status=archived` shows only archived. `status=ready` excludes archived AND requires all review flags false AND price > 0.

---

## CHANGES-23 additions

**FEAT-01 — eBay export env vars.** Three new optional settings in `api/app/config.py`: `ebay_shipping_profile`, `ebay_shipping_profile_alt`, `ebay_return_policy` (all default to empty string). Values must exactly match eBay Seller Hub account config (case-sensitive). Documented in `.env.example`.

**FEAT-02 — Export button on dashboard.** `Download` icon + "Export N" label in the search/filter row, right of the `ReviewEyeFilter`. Only visible when `statusFilter === 'ready'` AND `!isMobileDevice()`. Disabled (grayed, 0.5 opacity) when `total === 0` or export in progress. Triggers eBay CSV export flow.

**FEAT-03 — eBay CSV export.** `POST /api/exports` generates a ZIP file containing an eBay Seller Hub-compatible CSV and all photos for exported books. CSV columns: Action, Title, Category, ConditionID, Description, StartPrice, Quantity, Format, Duration, ShippingProfileName, ReturnProfileName, PictureName, CustomLabel, ISBN. Title format: `{title} by {author}`. Condition mapping: Very Good→4000, Good→5000, Acceptable→6000. Fixed values: Action=Add, Quantity=1, Format=FixedPrice, Duration=GTC. ZIP filename: `bookscan-export-YYYY-MM-DD.zip`. Frontend `exportBooks()` in `frontend/src/api/exports.ts` handles blob download with filename extraction from Content-Disposition.

**FEAT-04 — Post-export archiving and undo.** After export generation, all exported books are set to `archived=true`. An `export_batches` table (migration 009) tracks the last export: `id` (integer autoincrement), `exported_at` (timestamp), `book_ids` (JSON array of UUID strings). Only one batch at a time — new export deletes previous batch. Undo banner appears at top of dashboard content zone when a batch exists: green `filterGreenFill` background, `reviewGreen` border, "✓ N records exported and archived." with Undo and dismiss (X) buttons. Banner is persistent (database-driven, survives page refresh). Undo (`POST /api/exports/batch/undo`) sets `archived=false` on all batch books and deletes the batch. Dismiss (`DELETE /api/exports/batch`) deletes the batch without restoring. `ExportBatch` model in `api/app/models.py`; router in `api/app/routers/exports.py`.

---

## CHANGES-24 additions

**FEAT-01 — Photo ZIP export.** `POST /api/exports` now returns a ZIP file (`application/zip`) instead of a plain CSV. The ZIP contains: `bookscan-export-YYYY-MM-DD.csv` (the eBay CSV) and a `photos/` directory with all cover images + user photos named `{isbn}_{n}.jpg`. Cover image (from `book.cover_image_local`) is `{isbn}_1.jpg`; user photos follow in `created_at` order as `{isbn}_2.jpg`, `{isbn}_3.jpg`, etc. If no cover exists locally, user photos start at `_1.jpg`. Missing files (cover or user photo) are skipped gracefully with a `logger.warning` — the export continues. PictureName column in the CSV matches the actual files in the ZIP. Photo collection uses `_collect_photos()` helper called via `asyncio.to_thread` for blocking IO. `PHOTOS_DIR` module-level constant in `exports.py` for testability.

**Cover size upgrade (lookup time).** Open Library now prefers `covers["large"]` over `covers["medium"]` (fallback to medium if large absent). Google Books thumbnail URLs have `&zoom=1` replaced with `&zoom=0` and `&edge=curl` stripped, returning the full-size original image. Changes in `api/app/services/lookup.py`. Existing books with small covers are unaffected — new lookups get full-size going forward.

**FEAT-02 — Export button label.** Dashboard export button updated from `Export ${total}` to `Export ${total} (CSV + photos)` to reflect the ZIP contents.
