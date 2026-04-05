# BookScan CHANGES-02 Design

**Date:** 2026-04-04  
**Source:** CHANGES-02.md  
**Status:** Approved

---

## Scope & Ordering

All items from CHANGES-02.md are in scope except DASH-01 (per-row eBay copy button), which was explicitly removed. Implementation order follows CHANGES-02.md notes:

1. Bug fixes
2. Data model change
3. Scanning improvements
4. Phone UI overhaul
5. Scan audio feedback
6. Visual design overhaul (last)

Each group is a deployable milestone with server-side commands provided.

---

## Section 1: Bug Fixes

### BUG-01 — Review flag does not clear on dashboard

**Root cause:** `handleEdit` in `DashboardPage.tsx` explicitly sends `data_complete` from the pre-edit book snapshot, overriding the server's auto-recalculation logic in `PATCH /api/books/{id}`.

**Fix:**
- Remove `data_complete` from the PATCH payload in `handleEdit` so the server always recalculates it from key fields.
- Add a "Retain Flag" checkbox to `BookForm` — visible only when the book is currently flagged (`data_complete === false`), unchecked by default. Label: `Retain Flag`.
- When checked, include `data_complete: false` explicitly in the PATCH payload, bypassing server recalculation.
- The dashboard table row updates immediately after save via the existing `load()` call — no page refresh needed.

**Files changed:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/BookForm.tsx`

---

### BUG-02 / DASH-02 — CSV export outputs blob instead of discrete columns

**Fix:** Rewrite the `GET /api/listings?format=csv` endpoint to JOIN listings with their parent books. Output one row per listing with discrete columns:

```
title, author, publisher, edition, year, pages, dimensions, weight, subject,
description, condition, isbn, listing_text, created_at, ebay_status
```

**Files changed:** `api/app/routers/listings.py`

---

### BUG-03 — Plain text password in .env

**Fix:**
- Add `api/generate_hash.py` — standalone CLI script using `passlib`'s `CryptContext`. Usage: `python generate_hash.py <password>` → prints bcrypt hash to stdout.
- Rename `.env` variable from `PASSWORD` to `PASSWORD_HASH`.
- Update `api/app/config.py`: field renamed to `password_hash: str`.
- Update `api/app/auth.py`: login uses `pwd_context.verify(form_data.password, settings.password_hash)` instead of string equality.
- Update `.env.example` to reflect `PASSWORD_HASH=<run python generate_hash.py to get this>`.

**Files changed:** `api/generate_hash.py` (new), `api/app/config.py`, `api/app/auth.py`, `.env.example`  
**User action required:** Run `cd api && .venv/bin/python generate_hash.py <your-password>`, paste output into `.env` as `PASSWORD_HASH=...`, remove old `PASSWORD=` line.

---

## Section 2: Data Model

### DATA-01 — Add `condition` field to books table

**Schema change:**
- Add `condition: Mapped[str | None] = mapped_column(String(20))` to `api/app/models.py`. Valid values: `New`, `Very Good`, `Good`, `Acceptable`. No DB-level constraint.
- New Alembic migration: `api/alembic/versions/002_add_condition.py` — `ALTER TABLE books ADD COLUMN condition VARCHAR(20)`.

**API changes:**
- `BookCreate` and `BookUpdate` schemas: add `condition: Optional[str] = None`
- `BookResponse` schema: add `condition: Optional[str] = None`

**Frontend changes:**
- `types.ts`: add `condition: string | null` to both `Book` and `BookLookup`

**Downstream:**
- `generate_listing_text()` in `listings.py`: replace hardcoded `"Used"` with `book.condition or "Used"`
- CSV export: include `condition` column (covered by BUG-02 fix)
- Desktop edit form: `BookForm` gets a condition `<select>` with options: `""` (blank/unknown), `New`, `Very Good`, `Good`, `Acceptable`
- Phone review form: condition selector buttons (covered by PHONE-01)

**Files changed:** `api/app/models.py`, `api/alembic/versions/002_add_condition.py` (new), `api/app/schemas.py`, `frontend/src/types.ts`, `api/app/routers/listings.py`

**Deployment note:** `alembic upgrade head` must be run after deploy.

---

## Section 3: Scanning Improvements

### SCAN-01 — Library: keep @zxing/browser, switch to single-frame capture

**Decision:** `@zxing/browser` is retained. The "slow and hard to trigger" problem was the continuous `decodeFromVideoDevice` callback, not the library. SCAN-02 eliminates continuous scanning in favour of manual capture, which resolves the reliability issue without adding a new dependency.

**Implementation:**
- `BrowserMultiFormatReader` instance created once on component mount, reused across scans.
- Remove continuous `decodeFromVideoDevice` callback.
- On button press: draw current video frame to a hidden `<canvas>` (cropped to targeting rectangle per SCAN-03), then call `reader.decodeFromCanvas(canvas)`.
- If no barcode found, show inline error below the button: "No barcode found — try again". Does not block re-scan.

**Files changed:** `frontend/src/components/Scanner.tsx`

---

### SCAN-02 — Manual shutter button

- Replace the `<video>` auto-detection callback with an explicit "Scan" button rendered below the viewfinder.
- Button is large (full-width on mobile), green (`#22C55E` — a bright scan green distinct from the accent blue), prominent.
- Button state machine:
  - `Scan` → default state
  - `Scanning…` → while frame is being decoded (brief, ~50ms)
  - `Retry` → after a lookup returns `data_complete: false`
  - Returns to `Scan` after the user saves or cancels in PhoneReview
- Debounce: 500ms lock after each press to prevent double-firing.

**Files changed:** `frontend/src/components/Scanner.tsx`, `frontend/src/pages/ScanPage.tsx`

---

### SCAN-03 — Targeting mask overlay

- A `<div>` overlay using absolute positioning sits over the `<video>` element.
- The mask darkens the area outside a centered rectangle using `box-shadow: inset` — no canvas needed for the visual.
- Corner accent markers (4 L-shaped CSS elements) in `#0070F3` mark the active zone corners.
- The targeting rectangle is defined by fixed proportions: 80% of viewfinder width, 40% of height — appropriate for barcode aspect ratios.
- On button press, the canvas capture crops to exactly the targeting rectangle pixel coordinates before passing to ZXing decode.
- The overlay and corner markers are part of `Scanner.tsx`.

**Files changed:** `frontend/src/components/Scanner.tsx`

---

## Section 4: Phone UI Overhaul

### PHONE-01 — Post-scan review flow

A new `PhoneReview` component replaces the current use of `BookForm` in `ScanPage`. It is phone-only, mobile-first, never used on desktop.

**Layout (top to bottom):**
1. Cover image (80px wide, if available) + title (large), author, year, publisher — read-only display
2. Warning banner if `data_complete === false`: "Incomplete data — flag retained for desktop review"
3. Condition selector: four full-width-segment buttons `New` · `Very Good` · `Good` · `Acceptable`, `Very Good` pre-selected
4. "Save" button — full width, green — calls `saveBook({...bookData, condition})`, then returns to scanner
5. "Cancel" text link — returns to scanner without saving

`BookForm` is unchanged and continues to be used for the desktop edit flow.

**Files changed:** `frontend/src/components/PhoneReview.tsx` (new), `frontend/src/pages/ScanPage.tsx`

---

### PHONE-02 — Remove desktop scan button

Remove the `📱 Scan` link from the `DashboardPage` header. The `/scan` route remains functional (phone navigates there by URL/bookmark); there is simply no desktop entry point.

**Files changed:** `frontend/src/pages/DashboardPage.tsx`

---

### PHONE-03 — Real-time dashboard refresh via polling

- `DashboardPage` adds a `useEffect` that calls `load()` on a 3-second interval.
- The interval is cleared and restarted on page visibility change: paused when `document.visibilityState !== 'visible'`, resumed when visible.
- The interval is also cleared on unmount.
- No backend changes required.

**Files changed:** `frontend/src/pages/DashboardPage.tsx`

---

## Section 5: Scan Audio Feedback

### AUDIO-01 — Web Audio API tones

**Implementation:** A `useScanAudio()` hook in `frontend/src/hooks/useScanAudio.ts`.

- `AudioContext` created lazily on first invocation (satisfies mobile user-gesture requirement — the scan button tap that triggers decoding also enables the audio context).
- Exposes two functions: `playSuccess()` and `playReview()`.

**Tones:**
- `playSuccess()` (data complete): two-note ascending chime — 880Hz × 80ms then 1108Hz × 120ms, linear ramp fade-out
- `playReview()` (incomplete data): two-note descending tone — 440Hz × 150ms then 330Hz × 100ms, linear ramp fade-out
- Both use `OscillatorNode` + `GainNode` — no audio files, no additional permissions

**Button label logic:** `ScanPage` tracks `isRetry: boolean` state. Set to `true` after `playReview()` fires. Reset to `false` on save or cancel. Passed to `Scanner` as a prop to control button label.

**Files changed:** `frontend/src/hooks/useScanAudio.ts` (new), `frontend/src/pages/ScanPage.tsx`

---

## Section 6: Visual Design Overhaul

### DESIGN-01 — Geist-inspired design system

**Design tokens:** `frontend/src/styles/theme.ts` exports all design constants. No scattered inline values in components after this pass.

```ts
export const theme = {
  colors: {
    bg:      '#FFFFFF',
    surface: '#FAFAFA',
    border:  '#EAEAEA',
    text:    '#000000',
    muted:   '#666666',
    accent:  '#0070F3',
    danger:  '#E00000',
    scanGreen: '#22C55E',
  },
  font: {
    sans: "'Geist', 'Inter', system-ui, sans-serif",
    mono: "'Geist Mono', 'Fira Code', monospace",
  },
  radius: {
    sm: '4px',
    md: '8px',
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.08)',
  },
}
```

**Fonts:** Loaded via Google Fonts CDN in `frontend/index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">
```

**Components restyled (all reference theme tokens):**

| Component | Key changes |
|---|---|
| `LoginPage` | Centered card, clean labeled inputs, accent-colored submit button |
| `DashboardPage` | Full-width layout, top nav bar, clean search/filter bar |
| `BookTable` | 1px `border` row separators, no zebra, monospace ISBNs, condition badge |
| `BookForm` | Clean labeled inputs, `Retain Flag` checkbox styled inline |
| `PhoneReview` | Dark surface, large condition buttons, full-width Save button |
| `Scanner` | Dark viewfinder, mask overlay, green scan button |
| `ListingGenerator` | Clean modal card, monospace listing text |

**Principles enforced:**
- No gradients, no decorative elements, no unnecessary animation
- Generous whitespace, 1px low-contrast borders
- Flat buttons with clear hover/active states (opacity shift, not color change)
- Touch targets ≥ 44px on phone UI

**Files changed:** `frontend/src/styles/theme.ts` (new), `frontend/index.html`, all component and page files

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| SCAN-01: scanning library | Keep @zxing/browser | Problem was continuous-scan mode, not library; SCAN-02 eliminates it |
| BUG-03: hash utility | `api/generate_hash.py` script | Simplest; no new infra; passlib already in stack |
| PHONE-03: real-time updates | Polling at 3s | Simpler than WebSocket; latency acceptable for scan workflow |
| DESIGN-01: accent color | #0070F3 Vercel Blue | User's choice; matches spec suggestion |
| DASH-01: per-row copy button | **Removed from scope** | User decision |

---

## Deployment Milestones

### Milestone 1: Bug fixes + Data model
```bash
git pull
docker compose up -d --build
docker compose exec api alembic upgrade head
```
> Manual step: update `.env` — add `PASSWORD_HASH=<output of generate_hash.py>`, remove `PASSWORD=`.

### Milestone 2: Scanning improvements + Phone UI + Audio
```bash
git pull
docker compose up -d --build
```

### Milestone 3: Visual design overhaul
```bash
git pull
docker compose up -d --build
```
