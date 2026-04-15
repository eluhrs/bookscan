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

**StatusFilter dropdown (CHANGES-16 FEAT-05, border colors CHANGES-18 FIX-15).** `frontend/src/components/StatusFilter.tsx`. Compact button showing `Filter` + `ChevronDown` icons (no text label). Border color tracks the active filter: `#BA7517` (metadata review amber) / `#0070F3` (photography blue) / `#7F77DD` (description purple) / `#CCCCCC` (default gray) for `all` and the disabled `archived`. Dropdown options: All records / Needs metadata review / Needs photography / Needs description review / Ready to list / Archived (grayed, disabled). The active selection writes a `status` query param to `listBooks`; `archived` is defensively mapped to `'all'` at the call site and never reaches the server.

**Dashboard table styling (CHANGES-16).** Outer wrapper is just `overflow-x: auto` — the content zone provides L/R borders. Header row: `tableHeaderBg` (`#F5F5F5`) with lowercase labels (`review`, `title`, `author`, `publisher`, `year`, `actions`). Body rows: white background, `rowBorder` (`#F0F0F0`) bottom separators, row height adjusts naturally. **Review column** is a single centered column: green `Check` in `reviewGreen` when `!needs_metadata_review && !needs_photo_review`; otherwise a vertical stack of amber `FileWarning` (when `needs_metadata_review`) and/or blue `Camera` (when `needs_photo_review`). **Actions column** is icon-only on both desktop and mobile: unbordered `Pencil` + `Trash2` at `#888`. The Listing button was removed from every row in CHANGES-16; Generate Listing now only exists in the edit-page footer.

**Mobile scroll suppression.** `overflow-x: hidden` + `overscroll-behavior-y: none` on `html`/`body` in `index.html`. `WorkflowWrapper` outer container sets `maxWidth: '100vw'` and `overscrollBehavior: 'none'`.

**Haptic feedback.** Key events call `navigator.vibrate?.(25)`. iOS/Safari (all iOS browsers — Apple forces WebKit) doesn't support Web Vibration; the optional chain is a silent no-op. Android Chrome supports it. iOS absence is not a bug.

---

## AI Summaries (CHANGES-17 — details in `docs/HISTORY.md`)

**Core flow.** When a lookup returns no `description`, `PhotoWorkflowPage.handleLookupComplete` fires `generateSummary()` in parallel with entering Review. `aiSummary = {status: 'pending' | 'success' | 'failed', text}` is held in memory; a monotonic `aiGenIdRef` discards stale responses. On SAVE the final POST to `/api/books` carries `description` + `description_source: 'ai_generated'` in one round trip — no background task, no polling.

**Gemini config (non-obvious).** `gemini-2.5-flash-lite` (CHANGES-19 follow-up). The initial CHANGES-17 choice `gemini-2.5-flash` had a free-tier quota on this project of just 20 requests per ~30-second rolling window — daily testing burned through it and the API returned HTTP 429 `generate_content_free_tier_requests` on every subsequent call, surfacing as "Summary unavailable" in the UI. `gemini-2.0-flash` has free-tier limit 0 on this key. `gemini-2.5-flash-lite` has a separate quota window, passes the scholarly prompt cleanly, and returns equivalent 3-5 sentence output. Frontend timeout 8s; per-attempt backend timeout 3s with up to 3 attempts (2s backoff on 429, 500ms on 5xx). `MAX_OUTPUT_TOKENS = 400` AND `thinkingConfig.thinkingBudget = 0` are both required — without disabling thinking, the visible reply is truncated because Gemini 2.5 counts internal thinking tokens against the output budget. On 429/5xx/non-200 the backend logs the model name + HTTP status + first 500 chars of the response body so quota issues are immediately visible in `docker compose logs api`.

**Skipped when** lookup already returned a description, or `lookupResult.title` is null, or `GEMINI_API_KEY` is unset.

**Endpoints.** `POST /api/books/generate-summary` (20/min, auth required) is stateless and returns null on any failure — the workflow path. `POST /api/books` still has a `BackgroundTasks` safety-net (`generate_and_store_summary`) for non-workflow callers; it opens its own `async_session_maker()`.

**DB fields (migration 007).** `description_source` VARCHAR(32); `needs_description_review` BOOL; `description_generation_failed` BOOL (set only by the legacy background-task path — the lookup-time path surfaces failure as `aiSummary.status === 'failed'`). `?status=needs_description_review` is a `Literal` on `GET /api/books`; the `ready` filter requires all three review flags to be false.

**Duplicate ISBN handling (CHANGES-18 BUG-02).** `GET /api/books/lookup/{isbn}` returns `existing_book_id: UUID | None`. When set, `LookupStep` shows "This book is already in your library" and an "Open existing record" button that `navigate('/dashboard', { state: { editBookId } })`. `DashboardPage` picks up location state on mount, opens the edit view, then clears the state so refresh doesn't re-trigger. Review step is never entered for duplicates — no Gemini call, no 409.

---

## CHANGES-20 additions

**Shared `BookCard` component (FEAT-01).** `frontend/src/components/BookCard.tsx` is the single card component used by both the edit page and the workflow Review step. Controlled by the `editable: boolean` prop. `editable=true` → `InlineField`s with dashed underlines + additional-fields section + `commitDraft()` imperative handle. `editable=false` → static display nodes, no underlines, no additional fields. Both modes share filmstrip + condition bar + three review toggles + description block. Replaced the retired `BookEditCard.tsx` and the hand-rolled field block in `ReviewStep.tsx`.

**Field layout + typography (FEAT-02).** `frontend/src/styles/bookCard.css` defines `.bc-title` (18/500 #222), `.bc-author` (14/400 #222), `.bc-label` (10px small-caps #BBB), `.bc-value` (12 #222), `.bc-value-sm` (11 #222), `.bc-value-mono` (Geist Mono), `.bc-editable` (1px dashed #DDD), `.bc-row-inline` (flex row), `.bc-field-full` (label + stretched value). Field order: Title → Author → Publisher (own row) → Year / ISBN / Pages (inline row) → condition → review toggles → description → additional fields (editable only).

**`commitDraft()` imperative handle.** `BookCard` is now `forwardRef<BookCardHandle, BookCardProps>`. `BookCardHandle.commitDraft()` flushes the local `DraftFields` (title/author/publisher/year/pages/edition/dimensions/weight/description) through `props.onSave` as a `Partial<Book>`. `DashboardPage`'s edit-view SAVE button holds a `useRef<BookCardHandle>(null)` and calls `await bookCardRef.current?.commitDraft()` on click. `year` is parsed to `Number` (or null), same for `pages`.

**Year + Publisher inline-editable (FEAT-04).** Both fields are now `InlineField` instances in the editable path. Year onChange sanitizes to digits max 4: `v.replace(/[^0-9]/g, '').slice(0, 4)`. Publisher is plain text. Backend `BookUpdate` schema already accepted both — no API change needed.

**Hide-when-empty additional fields (FEAT-03).** The Edition / Dimensions / Weight grid renders only when `editable=true` AND at least one of the three has a value. No section header. When visible, all three fields render with em-dash placeholders for empty ones.

**Review step + button (FEAT-05).** `ReviewStep` passes `onAddPhoto={handleAddPhoto}` to `BookCard`; `BookCard` forwards it to `PhotoFilmstrip`, which renders the + tile. `handleAddPhoto` appends `{id: crypto.randomUUID(), file}` to `localPhotos`. No workflow state is touched — adding a photo stays on the Review step.

**Review-step virtual book.** Because `ReviewStep` has no persisted book yet, it builds a `virtualBook` via `useMemo` from `lookupResult` + in-memory state (`condition`, `reviewMetadata`, `reviewPhotography`, `reviewDescription`, `aiSummary`) and feeds it to `<BookCard editable={false} …/>`. A local `reviewImmediateSave(patch)` intercepts `onImmediateSave` calls from `BookCard` and only mutates local state — no network calls at review time. The persisted POST still happens in the existing `handleSave` triggered by `WorkflowWrapper`'s footer SAVE button.

**Post-iteration layout fixes.** Three bugs surfaced after the initial CHANGES-20 merge and were fixed in the same branch: (1) Title and Author rendered on the same line because `InlineField` returns an inline-block span — both are now wrapped in block-level `.bc-title-row` / `.bc-author-row` divs. (2) The edit-view inner wrapper in `DashboardPage` had `minHeight: 100%`, stretching content to full viewport height and leaving an empty white gap above the footer — removed, content sizes naturally. (3) Vertical spacing in the title block was compressed; added `margin-top: 14px` on `.bc-title-row`, `margin-bottom: 12px` on `.bc-author-row`, `margin-bottom: 8px` on `.bc-field-full`, and `margin-bottom: 20px` on `.bc-row-inline`. Also added `1rem 1.25rem` padding to the edit-view inner wrapper so content isn't flush against the L/R borders.

**TECH-01 — vitest tsconfig split.** `frontend/tsconfig.json` no longer excludes `__tests__` directories; it excludes the test globs (`src/**/*.test.ts{,x}` + setup file). A new `frontend/tsconfig.vitest.json` extends the main config and explicitly includes those globs with `types: ["vitest/globals", "@testing-library/jest-dom"]`. Not a `composite` project reference — `noEmit: true` in the main config is incompatible with `composite: true`, so the two configs run as independent `tsc -p` invocations. IDEs and CI can type-check both with `npx tsc --noEmit` + `npx tsc --noEmit -p tsconfig.vitest.json`. Six pre-existing test fixture bugs (missing `description_source` / `existing_book_id` fields added in CHANGES-17/18) surfaced when tsc started checking test files and were fixed in the same commit.

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
