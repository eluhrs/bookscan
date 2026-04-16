# BookScan — History

Historical iteration summaries moved out of CLAUDE.md for session-start leanness. Everything here is preserved verbatim from the original CLAUDE.md "Completed Iterations" section.

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
- DATA-01: Investigated dimensions/weight — data unavailability confirmed (see "Dimensions and weight" gotcha in CLAUDE.md)
- SCAN-01: Camera reliability overhaul — high resolution request, 3-strategy multi-crop decode loop, torch toggle, module-level torch state persistence; see "Manual barcode scanning" gotcha in CLAUDE.md
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

**CHANGES-13** — all items implemented, plus QA fixes:
- FIX-12: Horizontal scroll/drag on all mobile views fixed — `overflow-x: hidden` and `overscroll-behavior-y: none` on `html`/`body` globally in `index.html`; `maxWidth: '100vw'` and `overscrollBehavior: 'none'` on `WorkflowWrapper` outer container
- FIX-13: Border color unified to `#E0E0E0` (matching `zoneBg` header/footer darkness) — single change to `theme.colors.border` propagates globally
- FEAT-01: Mobile-responsive dashboard table — CSS media queries hide author/publisher/year/condition columns on `max-width: 767px`; desktop text action buttons (List/Edit/Delete) replaced by Lucide `Pencil`/`Trash2` icon buttons on mobile; row tap navigates to edit card; `stopPropagation` on all action buttons prevents double-fire with row click
- FEAT-02: Condition column removed from desktop dashboard table; `CONDITION_COLOR` constant deleted; condition remains visible and editable on `BookEditCard`
- QA fix: Camera error recovery — `retryCamera()` function added to `useCameraStream` hook; retry button shown in both PhotographStep and LookupStep when camera errors occur, so error state is recoverable without force-closing the browser
- QA fix: HTTP→HTTPS redirect in local dev — Vite plugin starts HTTP server on port 5180 (mapped to host 3000) that 301-redirects to HTTPS on 3001; mkcert cert regenerated to cover `localhost`, `127.0.0.1`, and `bloke.local` for network-independent phone access

---

## CHANGES-17 — AI Summaries (moved from CLAUDE.md 2026-04-15)

When a book lookup returns no `description` (none of Open Library / Google Books / LoC have one), `PhotoWorkflowPage` fires a **lookup-time** Gemini call in parallel with entering the Review step, so the description is available as soon as Review mounts. The result is held in memory until SAVE; the final POST to `/api/books` carries `description` + `description_source: 'ai_generated'` in a single round trip — no background task, no polling.

- Service: `api/app/services/ai_summary.py`
- Model: `gemini-2.5-flash`
- Free tier: 10 RPM / 500 RPD / 250K TPM — well within ~1 request per scan
- Frontend timeout: 8 seconds; per-attempt backend timeout 3.5s with one 5xx/network retry after 500ms backoff
- Token budget: `MAX_OUTPUT_TOKENS = 400` AND `thinkingConfig.thinkingBudget = 0` — Gemini 2.5 Flash counts internal "thinking" tokens against the output budget; without disabling thinking the visible reply gets truncated to ~4 tokens
- Skipped when: lookup already returned a description, or `lookupResult.title` is null, or `GEMINI_API_KEY` is unset

**Frontend flow.** `PhotoWorkflowPage.handleLookupComplete` calls `generateSummary({title, author, year, publisher})` immediately after the lookup resolves, sets `aiSummary = {status: 'pending'}` synchronously, updates to `success` / `failed` on response. A monotonic `aiGenIdRef` token discards stale responses. `ReviewStep` reads `aiSummary` via prop: pending → "Generating summary…", success → real text + toggle ON, failed → "Summary unavailable".

**Backend endpoints.**
- `POST /api/books/generate-summary` (rate limited 20/min, auth required) — stateless Gemini call, no DB writes. Returns null on missing API key, 429, timeout, or any failure. This is the path the workflow uses.
- `POST /api/books` retains a BackgroundTasks safety net for non-workflow POSTs: if no description AND `GEMINI_API_KEY` is set, it schedules `generate_and_store_summary` asynchronously. The frontend workflow bypasses this by sending `description` in the POST.
- `generate_and_store_summary(book_id)` opens its own `async_session_maker()`.

**DB fields (migration 007).**
- `description_source` VARCHAR(32) — one of `open_library | google_books | library_of_congress | ai_generated | manual` or NULL. Backend auto-derives from `data_sources['description']` only when the caller didn't provide a value.
- `needs_description_review` BOOL default false — set true when an AI summary is included in the POST.
- `description_generation_failed` BOOL default false — set on timeout/5xx/empty/repeated 429 (only the legacy background-task path writes it; the lookup-time path surfaces failure as `aiSummary.status === 'failed'` instead).

**`?status=needs_description_review`** is a `Literal` on `GET /api/books`. The `ready` filter requires all three review flags to be false.

---

## CHANGES-19 additions (moved from CLAUDE.md at CHANGES-20)

**iOS viewport lock (BUG-01).** `frontend/index.html` viewport meta is `width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no` — blocks iOS text-input auto-zoom. Single-user app, a11y tradeoff is intentional. The inline `<style>` also adds `html { touch-action: manipulation }` for double-tap zoom.

**Mobile overflow guards (BUG-02).** Top-level page wrappers all have `overflowX: 'hidden'`. Review toggles and ISBN cell have `wordBreak` (`break-word` on toggles, `break-all` on the monospace ISBN) so long strings don't push past 375px.

**Review-toggle two-line wrap (BUG-03).** `frontend/src/styles/reviewToggle.css` → `.review-toggle-label` with a `.rt-break` span that is `display: inline` on desktop, `display: block` ≤ 600px. `ReviewToggleButton` (ReviewStep pre-CHANGES-20) and `ReviewToggle` (BookEditCard pre-CHANGES-20; now `BookCard`) take `word1`/`word2` props and render `{word1}<span class="rt-break"> </span>{word2}` with `aria-label="{word1} {word2}"`. All three toggles identical height both breakpoints.

**Scholarly AI prompt (FEAT-01).** `build_prompt` in `api/app/services/ai_summary.py` asks for factual/scholarly 3-5 sentences with explicit bans on `captivating`, `perfect for`, `delve`, `journey`, `exploration`, value judgments. Test: `test_build_prompt_has_scholarly_tone_guardrails`.

**StatusFilter ring + fill (FEAT-02).** Active states are `{border, fill}` pairs: amber/blue/purple/green for needs_metadata_review/needs_photo_review/needs_description_review/ready, gray+white default. Fill tokens: `filterAmberFill` `#FAEEDA`, `filterBlueFill` `#E6F1FB`, `filterPurpleFill` `#EEEDFE`, `filterGreenFill` `#EAF3DE`.

**Mobile scrollbar (FEAT-04).** `frontend/src/styles/mobileScroll.css` → `.mobile-scroll` class on the scroll containers in ReviewStep and (pre-CHANGES-20) BookEditCard. Thin 6px bar under `@media (max-width: 600px)`, desktop untouched. Imported from `main.tsx`.

---

## CHANGES-20 additions

**Shared `BookCard` component (FEAT-01).** `frontend/src/components/BookCard.tsx` is the single card component used by both the edit page and the workflow Review step. Controlled by the `editable: boolean` prop. `editable=true` → `InlineField`s with dashed underlines + additional-fields section + `commitDraft()` imperative handle. `editable=false` → static display nodes, no underlines, no additional fields. Both modes share filmstrip + condition bar + three review toggles + description block. Replaced the retired `BookEditCard.tsx` and the hand-rolled field block in `ReviewStep.tsx`.

**Field layout + typography (FEAT-02).** `frontend/src/styles/bookCard.css` defines `.bc-title` (18/500 #222), `.bc-author` (14/400 #222), `.bc-label` (10px small-caps #BBB), `.bc-value` (12 #222), `.bc-value-sm` (11 #222), `.bc-value-mono` (Geist Mono), `.bc-editable` (1px dashed #DDD), `.bc-row-inline` (flex row). Field order: Title → Author → Publisher (own row) → Year / ISBN / Pages (inline row) → condition → review toggles → description → additional fields (editable only).

**`commitDraft()` imperative handle.** `BookCard` is `forwardRef<BookCardHandle, BookCardProps>`. `BookCardHandle.commitDraft()` flushes the local `DraftFields` (title/author/publisher/isbn/year/pages/edition/dimensions/weight/description) through `props.onSave` as a `Partial<Book>`. `DashboardPage`'s edit-view SAVE button holds a `useRef<BookCardHandle>(null)` and calls `await bookCardRef.current?.commitDraft()` on click. `year` and `pages` are parsed to `Number` (or null).

**Year + Publisher inline-editable (FEAT-04).** Both fields are `InlineField` instances. Year onChange sanitizes to digits max 4. Backend `BookUpdate` already accepted both — no API change needed.

**Hide-when-empty additional fields (FEAT-03).** The Edition / Dimensions / Weight grid renders only when `editable=true` AND at least one of the three has a value. No section header. When visible, all three fields render with em-dash placeholders for empty ones.

**Review step + button (FEAT-05).** `ReviewStep` passes `onAddPhoto={handleAddPhoto}` to `BookCard`; `BookCard` forwards it to `PhotoFilmstrip`, which renders the + tile. `handleAddPhoto` appends `{id: crypto.randomUUID(), file}` to `localPhotos`. No workflow state is touched — adding a photo stays on the Review step.

**Review-step virtual book.** `ReviewStep` has no persisted book yet, so it builds a `virtualBook` via `useMemo` from `lookupResult` + in-memory state and feeds it to `<BookCard editable={false} …/>`. A local `reviewImmediateSave(patch)` intercepts `onImmediateSave` calls and only mutates local state — no network calls at review time. The persisted POST still happens in `handleSave` via `WorkflowWrapper`'s footer SAVE button.

**Review step editable (FEAT-06, scope addition).** Review step now passes `editable={true}` to BookCard, so Title / Author / Publisher / Year / ISBN / Pages / Description are all inline-editable with the same dashed-underline affordance as the Edit page. BookCard exposes a second imperative method `getDraft(): Partial<Book>` that returns the current draft synchronously without calling `onSave`. ReviewStep holds a `bookCardRef`, pulls the draft via `getDraft()` in `handleSave`, and merges it into the `POST /books` payload (overriding `lookupResult` values where the user edited). BookCard's draft re-sync changed from `[book]` to `[book.id]` + a separate `[book.description]` effect, so unrelated parent re-renders (virtualBook re-memoizing on condition / review-toggle / aiSummary transitions) don't clobber in-flight user edits; the description-specific effect still lets Gemini async responses and edit-page regenerate flow through.

**Post-iteration layout + editability fixes.** Title/Author wrapped in `.bc-title-row` / `.bc-author-row` block divs; title block vertical spacing via `.bc-title-row` (14px top), `.bc-author-row` (12px bottom), `.bc-field-full` (8px), `.bc-row-inline` (20px); edit-view content wrapper gained `1rem 1.25rem` padding and `minHeight: 100%` so L/R borders reach the footer top border; `InlineField` has a `compact` prop for Year/ISBN/Pages (content-sized `width: Nch`) — default mode is `display: block` with `whiteSpace: pre-wrap` for multiline description; ISBN fully editable (added to `DraftFields`, `commitDraft()`, and `BookUpdate` schema); description block no longer uses the `.bc-field-full` flex wrapper (its `align-items: baseline` was collapsing multiline content).

**TECH-01 — vitest tsconfig split.** `frontend/tsconfig.json` now excludes the test globs (`src/**/*.test.ts{,x}` + setup file). A new `frontend/tsconfig.vitest.json` extends the main config and includes those globs with `types: ["vitest/globals", "@testing-library/jest-dom"]`. Not a composite project reference — `noEmit: true` in the main config is incompatible with `composite: true`, so they run as independent `tsc -p` invocations. Type-check both with `npx tsc --noEmit` + `npx tsc --noEmit -p tsconfig.vitest.json`.
