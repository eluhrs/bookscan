# BookScan Photo Workflow — Design Spec
**Date:** 2026-04-06
**Feature:** FEAT-01 Multi-Step Book Photography Workflow (CHANGES-04.md)

---

## Overview

Replace the current single-screen scan-and-save flow with a three-step workflow: Photograph → Lookup → Review. Users photograph the physical book first, then scan the barcode or enter the ISBN manually, then review and save the complete record. At least one photo is required before a record can be saved.

The old `ScanPage` and `Scanner` components are deleted. The new `PhotoWorkflowPage` replaces `/scan` entirely. No quick-scan fallback route is added.

---

## Architecture & File Changes

### New frontend files
```
frontend/src/pages/PhotoWorkflowPage.tsx
frontend/src/components/workflow/WorkflowWrapper.tsx
frontend/src/components/workflow/PhotographStep.tsx
frontend/src/components/workflow/LookupStep.tsx
frontend/src/components/workflow/ReviewStep.tsx
frontend/src/api/photos.ts
```

### Deleted frontend files
```
frontend/src/pages/ScanPage.tsx
frontend/src/components/Scanner.tsx       # logic absorbed into LookupStep
frontend/src/components/PhoneReview.tsx   # logic absorbed into ReviewStep
```

### Modified frontend files
```
frontend/src/App.tsx          # /scan → PhotoWorkflowPage
frontend/src/pages/DashboardPage.tsx  # photo grid + missing-photos indicator
frontend/src/types.ts         # BookPhoto interface, has_photos on Book
```

### New backend files
```
api/app/routers/photos.py
api/alembic/versions/003_add_book_photos.py
```

### Modified backend files
```
api/app/models.py     # BookPhoto model, photos relationship on Book
api/app/schemas.py    # BookPhotoResponse, has_photos on BookResponse
api/app/main.py       # register photos router
```

---

## WorkflowWrapper Component

All three steps share a consistent six-zone layout rendered by `WorkflowWrapper`:

1. Header — BookScan title + Dashboard link
2. Progress indicator — centered, ○/● dots for each step
3. Controls bar — `ReactNode`, varies per step (null on Review)
4. Main content area — `ReactNode`, largest zone, varies per step
5. Primary button — large, blue, label and disabled state per step
6. Cancel — small gray centered text

```ts
interface WorkflowWrapperProps {
  step: 'photograph' | 'lookup' | 'review'
  controls: ReactNode
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  onCancel: () => void
  children: ReactNode
}
```

Progress indicator format: `○·Photograph  ●·Lookup  ○·Review` — only the current step is filled, no checkmarks.

Layout: `100dvh` flex column, `background: #000`, `color: #fff`.

---

## PhotoWorkflowPage State Machine

```ts
type WorkflowStep = 'photograph' | 'lookup' | 'review'

const [step, setStep]               = useState<WorkflowStep>('photograph')
const [photos, setPhotos]           = useState<File[]>([])
const [targetCount, setTargetCount] = useState<number>(
  () => Number(localStorage.getItem('photoTargetCount') ?? 3)
)
const [lookupResult, setLookupResult] = useState<BookLookup | null>(null)
const [savedBookId, setSavedBookId]   = useState<string | null>(null)
// lookupMode ('camera' | 'keyboard') is internal to LookupStep — not needed at page level
```

`savedBookId` is set after a successful `POST /api/books`. If the subsequent photo upload fails, SAVE re-attempts only `POST /api/books/{savedBookId}/photos` — it does not re-create the book.

**Transitions:**
- Photograph → Lookup: auto when `photos.length >= targetCount`
- Lookup → Review: auto on successful ISBN lookup
- Any step → Photograph (Cancel): discard photos + lookupResult, reset all state

Photos are held in browser memory as `File` objects until Save is tapped. They are never uploaded to the server before that point.

---

## PhotographStep

**Controls bar:** `<select>` (left-aligned), options 1–5, value = `targetCount`. On change: updates parent state and writes to `localStorage('photoTargetCount')`.

**Main content:** Grid of thumbnail previews for captured `photos` (≈80px square, `object-cover`).

**Primary button (CAPTURE):** Calls `.click()` on a hidden `<input type="file" accept="image/*" capture="environment">`. Each tap opens the native iOS/Android camera picker — single photo per tap. `onChange` appends the new `File` to `photos` via parent callback. When `photos.length >= targetCount` after append, parent calls `setStep('lookup')`.

---

## LookupStep

### Camera mode
**Controls bar:** keyboard icon (left, taps to switch to keyboard mode), torch toggle (right).

**Main content:** Live viewfinder + targeting mask. Identical to the existing `Scanner` component:
- `getUserMedia` with `{ facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }`
- `BrowserMultiFormatReader` from `@zxing/browser`
- 3-strategy crop decode loop (standard 80×40%, wide strip 95×25%, center zoom 50×30% 2×)
- Torch toggle via `applyConstraints({ advanced: [{ torch }] })`
- Module-level `persistedTorchOn` variable for torch state across remounts

**Primary button (LOOKUP):** Captures single frame, runs 3-strategy decode.
- Success: calls `onLookupSuccess(isbn)` in parent → parent calls `/api/books/lookup/{isbn}` → on result, `setLookupResult(data)`, `setStep('review')`, play `playSuccess()` or `playReview()` based on `data.data_complete`
- Fail: play `playReview()` (negative tone), update hint text: "No barcode found — try again"

### Keyboard mode
**Controls bar:** camera icon (left, taps back to camera mode).

**Main content:** ISBN text input, `inputMode="numeric"`, autofocused on mount.

**Primary button (LOOKUP):** Submits the ISBN text to `/api/books/lookup/{isbn}`. Same success/fail behavior as camera mode.

**Hint text (below primary button):**
- Camera mode: "Align barcode and tap Lookup, or use keyboard"
- Keyboard mode: "Type ISBN-10 or ISBN-13"

---

## ReviewStep

**Controls bar:** null (empty).

**Main content:**
- Cover thumbnail from `lookupResult.cover_image_url` (small, renders if present)
- Title, Author
- Year · Publisher (muted)
- Condition selector: New / Very Good / Good / Acceptable / Poor — required, no default (SAVE disabled until selected)
- "Flag for review" checkbox — pre-checked when `!lookupResult.data_complete`, user can override

**Primary button (SAVE):** Disabled until condition is selected. On tap:
1. Compress each `File` in `photos` client-side: canvas resize to max 1200px on longest edge, `toBlob` at 85% JPEG quality
2. `POST /api/books` with metadata + condition + `data_complete` (false if flag checked)
3. `POST /api/books/{id}/photos` multipart with compressed files
4. Play `playSuccess()`
5. Reset all state (`photos: []`, `lookupResult: null`, `step: 'photograph'`)

**Error handling:**
- Step 2 fails: show inline error on Review screen, no book created
- Step 3 fails: show inline error, book exists but has no photos — user can retry (re-tap SAVE re-attempts photo upload only, or cancel and re-scan)

---

## Backend: BookPhoto Model

```python
class BookPhoto(Base):
    __tablename__ = "book_photos"
    id: UUID primary key, default=uuid4
    book_id: UUID FK → books.id ON DELETE CASCADE
    filename: VARCHAR(500)   # relative: "{book_id}/{photo_id}.jpg"
    created_at: TIMESTAMP server_default=now()
```

`Book` model gets: `photos: Mapped[list["BookPhoto"]] = relationship(back_populates="book", passive_deletes=True)`

Files stored at: `/app/photos/{book_id}/{photo_id}.jpg`

---

## Backend: Photo Endpoints (`routers/photos.py`)

All endpoints require `Authorization: Bearer <token>`.

```
POST   /api/books/{id}/photos        # upload 1+ files (multipart/form-data)
GET    /api/books/{id}/photos        # list BookPhotoResponse[]
DELETE /api/photos/{photo_id}        # 204, deletes file + DB row
GET    /api/photos/{photo_id}/file   # FileResponse (authenticated)
```

Upload: accepts `files: list[UploadFile]`, writes each to `/app/photos/{book_id}/{uuid}.jpg`, inserts `BookPhoto` rows. Returns `list[BookPhotoResponse]`.

File serving: `GET /api/photos/{photo_id}/file` reads from disk, returns `FileResponse`. Required because `/app/photos` is container-internal — the frontend fetches via `apiFetch` and renders as blob URLs.

---

## Backend: Schema Additions

```python
class BookPhotoResponse(BaseModel):
    id: UUID
    book_id: UUID
    filename: str
    created_at: datetime
    model_config = {"from_attributes": True}
```

`BookResponse` gains `has_photos: bool` (computed via EXISTS subquery in router, not a model field) — included in **both** the list endpoint and single-book GET so the dashboard table can show the missing-photos indicator. `photos: list[BookPhotoResponse] = []` is populated only on single-book GET (not the list endpoint) to avoid N+1 query overhead.

---

## Migration 003

```sql
CREATE TABLE book_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_book_photos_book_id ON book_photos(book_id);
```

Run after deploy:
```bash
docker compose exec api alembic upgrade head
```

---

## Dashboard Changes

**Missing-photos indicator in `BookTable`:** Small inline badge or camera icon shown on rows where `book.has_photos === false`. Display-only — no filter added.

**Photo grid in book detail view:** When `editingBook` is set in `DashboardPage`, fetch `GET /api/books/{id}/photos`. Render above the `BookForm` as a 3–4 column responsive grid of ≈100px thumbnails. Each thumbnail has a delete (×) button — calls `DELETE /api/photos/{photo_id}`, updates local state. Thumbnails fetched via `apiFetch` → blob URL (same pattern as CSV export) since the endpoint is authenticated. Blob URLs must be revoked (`URL.revokeObjectURL`) when the component unmounts to avoid memory leaks.

---

## Audio Feedback

| Event | Sound |
|---|---|
| Lookup fails (no barcode / API error) | `playReview()` — negative descending tone |
| Lookup succeeds, data complete | `playSuccess()` — positive ascending tone |
| Lookup succeeds, data incomplete | `playReview()` — review tone, flag auto-checked |
| Save succeeds | `playSuccess()` |

`useScanAudio` hook used unchanged in `PhotoWorkflowPage`.

---

## Testing

### Backend (`test_photos.py`)
- Upload photos to existing book → 201, files on disk, DB rows created
- List photos for book → correct rows returned
- Delete photo → 204, file removed, row deleted
- Upload to nonexistent book → 404
- Delete book → photo rows cascade-deleted

### Frontend (Vitest)
- `WorkflowWrapper`: all six zones render, correct step highlighted in progress indicator
- `PhotographStep`: reaching `targetCount` calls `onAdvance`
- `LookupStep`: keyboard mode renders ISBN input; mode toggle switches controls bar
- `ReviewStep`: SAVE disabled until condition selected; flag pre-checked when `data_complete: false`

---

## Decisions to Document in CLAUDE.md

- Photo storage uses `book_photos` table (not JSON column on `books`) — enables individual row deletes and per-book queries without array mutation
- `has_photos` is computed via EXISTS subquery in the router, not a denormalized column — avoids migration and stays consistent with cascade deletes
- "Flag for review" maps to `data_complete = false` (explicit override, not recalculated)
- Old `ScanPage` / `Scanner` / `PhoneReview` deleted — recoverable via git if needed
- `Poor` added as 5th condition option (spec CHANGES-04 adds it)
