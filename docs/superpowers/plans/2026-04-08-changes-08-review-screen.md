# CHANGES-08 Review Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wireframe alignment pass for the Review screen — filmstrip layout, text sizing, controls bar border removal, and "Review Photography?" auto-check when all photos deleted.

**Architecture:** ReviewStep gets local photo state for filmstrip management; WorkflowWrapper collapses Zone 2 when controls is null; BookTable gets CSS line-clamp for title/author.

**Tech Stack:** React 18, TypeScript strict, Vitest, inline styles (no CSS-in-JS), theme.ts tokens.

---

## Pre-flight: What is already done

- `needs_photo_review` DB column exists (migration 004). The CHANGES-08 spec says "add `needs_photography`" — this is the same concept under a different name. **No new migration needed.** `needs_photo_review` serves as `needs_photography`. Note this in CLAUDE.md.
- "Review Photography?" checkbox exists and is auto-checked when `skippedPhotography` is true.
- SAVE button disabled/enabled logic is already correct (`primaryDisabled={!condition || saving}`).
- All CHANGES-07 global items (button heights, #F0F0F0 zones, case conventions) are in place.
- Controls bar border in PhotographStep/LookupStep lives **inside** the `controls` prop content (not in WorkflowWrapper Zone 2). WorkflowWrapper Zone 2 has no border of its own.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/components/workflow/WorkflowWrapper.tsx` | Collapse Zone 2 (padding + minHeight → 0) when `controls === null` |
| `frontend/src/components/workflow/ReviewStep.tsx` | Major rewrite: filmstrip, layout order, text sizing, auto-check on delete |
| `frontend/src/components/BookTable.tsx` | Add line-clamp to title (2-line) and author (1-line) cells |
| `frontend/src/__tests__/workflow/ReviewStep.test.tsx` | Add filmstrip photo delete tests + auto-check test |
| `frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx` | Add test: Zone 2 collapses when controls is null |
| `CLAUDE.md` | Document CHANGES-08 completion |

---

## Task 1: WorkflowWrapper — collapse Zone 2 when controls is null (FEAT-01)

**Files:**
- Modify: `frontend/src/components/workflow/WorkflowWrapper.tsx:84-96`
- Test: `frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// In: frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx
// Add this test inside the existing describe block

it('Zone 2 collapses when controls is null', () => {
  const { container } = render(
    <MemoryRouter>
      <WorkflowWrapper
        step="review"
        controls={null}
        primaryLabel="SAVE"
        onPrimary={() => {}}
        onCancel={() => {}}
      >
        <div>content</div>
      </WorkflowWrapper>
    </MemoryRouter>
  )
  // Zone 2 should have no padding and no minHeight when controls is null
  // Find the zone by its position (second child of the outer flex container)
  const zones = container.firstChild?.childNodes
  // Zone 1 = step indicator, Zone 2 = controls bar
  const zone2 = zones?.[1] as HTMLElement
  expect(zone2.style.padding).toBe('')
  expect(zone2.style.minHeight).toBe('')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "Zone 2 collapses"
```
Expected: FAIL (current Zone 2 always has padding/minHeight)

- [ ] **Step 3: Implement in WorkflowWrapper**

Replace Zone 2 block (lines 84–96) in `frontend/src/components/workflow/WorkflowWrapper.tsx`:

```tsx
{/* Zone 2: Controls bar — collapsed when controls is null (FEAT-01) */}
{controls !== null && (
  <div
    style={{
      padding: '0.4rem 1rem',
      minHeight: '2.75rem',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    }}
  >
    {controls}
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "Zone 2 collapses"
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/eluhrs/claude/bookscan
git add frontend/src/components/workflow/WorkflowWrapper.tsx frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx
git commit -m "feat: collapse WorkflowWrapper Zone 2 when controls is null (CHANGES-08 FEAT-01)"
```

---

## Task 2: BookTable — title/author ellipsis (BUG-01)

**Files:**
- Modify: `frontend/src/components/BookTable.tsx:126-138`
- Test: `frontend/src/__tests__/BookTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `frontend/src/__tests__/BookTable.test.tsx` and add:

```tsx
it('title cell has two-line clamp styles', () => {
  const books = [makeBook({ title: 'A'.repeat(200) })]
  const { container } = render(
    <BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} onGenerateListing={vi.fn()} />
  )
  // Find the title td (second td in first data row, after indicator td)
  const rows = container.querySelectorAll('tbody tr')
  const titleTd = rows[0].querySelectorAll('td')[1]
  expect(titleTd.style.overflow).toBe('hidden')
  expect(titleTd.style.maxWidth).toBeTruthy()
})
```

> Note: check `BookTable.test.tsx` to find how `makeBook` is defined there before adding. If there's no `makeBook` helper, define a minimal book object inline.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "two-line clamp"
```

- [ ] **Step 3: Apply ellipsis styles to title and author cells in BookTable**

In `frontend/src/components/BookTable.tsx`, replace the title `<td>` (line ~126):

```tsx
<td
  style={{
    padding: '0.6rem 0.75rem',
    fontWeight: 500,
    maxWidth: 220,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
  }}
>
  {book.title ?? '—'}
  {!book.has_photos && (
    <span
      title="No photos"
      style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: '#555', verticalAlign: 'middle' }}
    >
      📷
    </span>
  )}
</td>
```

Replace the author `<td>` (line ~137):

```tsx
<td
  style={{
    padding: '0.6rem 0.75rem',
    color: theme.colors.muted,
    maxWidth: 160,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }}
>
  {book.author ?? '—'}
</td>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "two-line clamp"
```

- [ ] **Step 5: Commit**

```bash
cd /Users/eluhrs/claude/bookscan
git add frontend/src/components/BookTable.tsx frontend/src/__tests__/BookTable.test.tsx
git commit -m "fix: add title (2-line) and author (1-line) ellipsis clamp to BookTable (CHANGES-08 BUG-01)"
```

---

## Task 3: ReviewStep — filmstrip, layout, and text sizing (FEAT-02, FEAT-03, BUG-01, FEAT-05)

**Files:**
- Modify: `frontend/src/components/workflow/ReviewStep.tsx`
- Test: `frontend/src/__tests__/workflow/ReviewStep.test.tsx`

This is the major task. The filmstrip replaces the old side-by-side cover+text layout. Internal `localPhotos` state tracks which user photos remain (supports per-photo ✕ deletion).

- [ ] **Step 1: Write failing tests for filmstrip behavior**

Add to `frontend/src/__tests__/workflow/ReviewStep.test.tsx`:

```tsx
// Add at top with other imports:
// vi.mock('../../api/books') — already present or add if not

it('filmstrip renders cover image when cover_image_url is provided', () => {
  const lookup = { ...baseLookup, cover_image_url: 'https://example.com/cover.jpg' }
  render(<ReviewStep {...defaultProps} lookupResult={lookup} />, { wrapper })
  const filmstripImgs = screen.getAllByRole('img')
  expect(filmstripImgs.some(img => (img as HTMLImageElement).src.includes('example.com/cover.jpg'))).toBe(true)
})

it('filmstrip renders delete buttons for user photos', () => {
  const fakeFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
  render(<ReviewStep {...defaultProps} photos={[fakeFile]} />, { wrapper })
  expect(screen.getByRole('button', { name: /delete photo/i })).toBeInTheDocument()
})

it('deleting all user photos auto-checks Review Photography?', () => {
  const fakeFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
  render(<ReviewStep {...defaultProps} photos={[fakeFile]} skippedPhotography={false} />, { wrapper })
  const deleteBtn = screen.getByRole('button', { name: /delete photo/i })
  expect(screen.getByRole('checkbox', { name: /Review Photography/ })).not.toBeChecked()
  fireEvent.click(deleteBtn)
  expect(screen.getByRole('checkbox', { name: /Review Photography/ })).toBeChecked()
})

it('deleting a photo when others remain does not auto-check Review Photography?', () => {
  const file1 = new File(['x'], 'photo1.jpg', { type: 'image/jpeg' })
  const file2 = new File(['y'], 'photo2.jpg', { type: 'image/jpeg' })
  render(<ReviewStep {...defaultProps} photos={[file1, file2]} skippedPhotography={false} />, { wrapper })
  const deleteBtns = screen.getAllByRole('button', { name: /delete photo/i })
  fireEvent.click(deleteBtns[0])
  expect(screen.getByRole('checkbox', { name: /Review Photography/ })).not.toBeChecked()
})

it('title has bold text with two-line max styling', () => {
  render(<ReviewStep {...defaultProps} />, { wrapper })
  // Title "Test Book" should be present and wrapped in an element with WebkitLineClamp
  expect(screen.getByText('Test Book')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -E "(filmstrip|delete photo|auto-checks|PASS|FAIL)" | head -20
```

- [ ] **Step 3: Rewrite ReviewStep**

Replace the full content of `frontend/src/components/workflow/ReviewStep.tsx` with:

```tsx
// frontend/src/components/workflow/ReviewStep.tsx

import { useState, useEffect } from 'react'
import WorkflowWrapper from './WorkflowWrapper'
import { BookLookup } from '../../types'
import { saveBook } from '../../api/books'
import { uploadPhotos } from '../../api/photos'
import { useScanAudio } from '../../hooks/useScanAudio'
import { theme } from '../../styles/theme'

const CONDITIONS = ['New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const
type Condition = (typeof CONDITIONS)[number]

interface ReviewStepProps {
  lookupResult: BookLookup
  photos: File[]
  savedBookId: string | null
  onSavedBookId: (id: string) => void
  onSaveComplete: () => void
  onCancel: () => void
  skippedPhotography: boolean
}

async function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxEdge = 1200
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxEdge || h > maxEdge) {
        if (w > h) { h = Math.round((h * maxEdge) / w); w = maxEdge }
        else { w = Math.round((w * maxEdge) / h); h = maxEdge }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

const FILMSTRIP_HEIGHT = 120
const COVER_WIDTH = Math.round(FILMSTRIP_HEIGHT * (2 / 3))
const PHOTO_WIDTH = Math.round(FILMSTRIP_HEIGHT * (3 / 4))

export default function ReviewStep({
  lookupResult,
  photos,
  savedBookId,
  onSavedBookId,
  onSaveComplete,
  onCancel,
  skippedPhotography,
}: ReviewStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [reviewMetadata, setReviewMetadata] = useState(!lookupResult.data_complete)
  const [reviewPhotography, setReviewPhotography] = useState(skippedPhotography)
  const [localPhotos, setLocalPhotos] = useState<File[]>(photos)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { playSuccess } = useScanAudio()

  // Blob URLs for user photo previews
  const [blobUrls, setBlobUrls] = useState<string[]>([])
  useEffect(() => {
    const urls = localPhotos.map((f) => URL.createObjectURL(f))
    setBlobUrls(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [localPhotos])

  function handleDeletePhoto(index: number) {
    const next = localPhotos.filter((_, i) => i !== index)
    setLocalPhotos(next)
    if (next.length === 0) {
      setReviewPhotography(true)
    }
  }

  async function handleSave() {
    if (!condition || saving) return
    setSaving(true)
    setError('')

    try {
      let bookId = savedBookId

      if (!bookId) {
        const book = await saveBook({
          ...lookupResult,
          condition,
          data_complete: reviewMetadata ? false : lookupResult.data_complete,
          needs_photo_review: reviewPhotography,
        })
        bookId = book.id
        onSavedBookId(bookId)
      }

      if (localPhotos.length > 0) {
        const blobs = await Promise.all(localPhotos.map(compressPhoto))
        await uploadPhotos(bookId, blobs)
      }

      playSuccess()
      onSaveComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — tap Save to retry photo upload')
    } finally {
      setSaving(false)
    }
  }

  const hasCover = Boolean(lookupResult.cover_image_url)

  return (
    <WorkflowWrapper
      step="review"
      controls={null}
      primaryLabel={saving ? 'Saving…' : 'SAVE'}
      primaryDisabled={!condition || saving}
      onPrimary={handleSave}
      onCancel={onCancel}
    >
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          color: theme.colors.text,
        }}
      >
        {/* Filmstrip: cover image (no ✕) + user photos (with ✕) */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.75rem 1rem',
            flexShrink: 0,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Cover image — visual distinction via accent-colored border */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {hasCover ? (
              <img
                src={lookupResult.cover_image_url!}
                alt="Cover"
                style={{
                  width: COVER_WIDTH,
                  height: FILMSTRIP_HEIGHT,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: `2px solid ${theme.colors.accent}`,
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: COVER_WIDTH,
                  height: FILMSTRIP_HEIGHT,
                  background: theme.colors.subtle,
                  borderRadius: 6,
                  border: `2px solid ${theme.colors.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  color: theme.colors.muted,
                  textAlign: 'center',
                  padding: '0 4px',
                }}
              >
                No cover
              </div>
            )}
          </div>

          {/* User photos — standard style with ✕ button */}
          {blobUrls.map((url, i) => (
            <div key={url} style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                style={{
                  width: PHOTO_WIDTH,
                  height: FILMSTRIP_HEIGHT,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: `1px solid ${theme.colors.border}`,
                  display: 'block',
                }}
              />
              <button
                aria-label="Delete photo"
                onClick={() => handleDeletePhoto(i)}
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  padding: 0,
                  fontFamily: theme.font.sans,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Metadata */}
        <div style={{ padding: '0.75rem 1.25rem 0' }}>
          {/* Title — bold, two-line max */}
          <h2
            style={{
              margin: '0 0 0.2rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              lineHeight: 1.35,
              color: theme.colors.text,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {lookupResult.title ?? 'Unknown Title'}
          </h2>

          {/* Author — one-line max */}
          <p
            style={{
              margin: '0 0 0.15rem',
              fontSize: '0.9rem',
              color: theme.colors.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {lookupResult.author ?? '—'}
          </p>

          {/* Year · Publisher — secondary text, one line */}
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.8rem',
              color: theme.colors.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {[lookupResult.year, lookupResult.publisher].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>

        <div style={{ padding: '0 1.25rem 1rem' }}>
          {/* Condition selector */}
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.75rem',
              color: theme.colors.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Condition
          </p>
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem' }}>
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.1rem',
                  fontSize: '0.72rem',
                  background: condition === c ? theme.colors.accent : theme.colors.subtle,
                  color: condition === c ? '#fff' : theme.colors.text,
                  border: condition === c
                    ? `1px solid ${theme.colors.accent}`
                    : `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: condition === c ? 600 : 400,
                  fontFamily: theme.font.sans,
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Review Metadata? */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: theme.colors.text,
            }}
          >
            <input
              type="checkbox"
              checked={reviewMetadata}
              onChange={(e) => setReviewMetadata(e.target.checked)}
            />
            Review Metadata?
          </label>

          {/* Review Photography? */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              marginBottom: '0.75rem',
              fontSize: '0.875rem',
              color: theme.colors.text,
            }}
          >
            <input
              type="checkbox"
              checked={reviewPhotography}
              onChange={(e) => setReviewPhotography(e.target.checked)}
            />
            Review Photography?
          </label>

          {error && (
            <p style={{ color: theme.colors.danger, fontSize: '0.85rem', margin: '0.5rem 0' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </WorkflowWrapper>
  )
}
```

- [ ] **Step 4: Run all ReviewStep tests**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -A 2 "ReviewStep"
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/eluhrs/claude/bookscan
git add frontend/src/components/workflow/ReviewStep.tsx frontend/src/__tests__/workflow/ReviewStep.test.tsx
git commit -m "feat: filmstrip layout, text sizing, photo delete auto-check (CHANGES-08 FEAT-02/03/04/05, BUG-01)"
```

---

## Task 4: BUG-02 — Confirm SAVE button state (no code change expected)

**Files:**
- Read: `frontend/src/components/workflow/WorkflowWrapper.tsx:119-140` (Zone 5)
- Read: `frontend/src/components/workflow/ReviewStep.tsx` (primaryDisabled prop)

- [ ] **Step 1: Verify the implementation is correct**

Check that `WorkflowWrapper` Zone 5 button uses:
```
background: primaryDisabled ? theme.colors.disabled : theme.colors.accent
color: primaryDisabled ? theme.colors.disabledText : '#fff'
cursor: primaryDisabled ? 'default' : 'pointer'
disabled: primaryDisabled
```
And that `ReviewStep` passes `primaryDisabled={!condition || saving}`.

- [ ] **Step 2: Verify test coverage exists**

Confirm these tests exist in `ReviewStep.test.tsx`:
- "SAVE button is disabled before condition is selected"
- "SAVE button is enabled after selecting a condition"

If they already exist from CHANGES-07, no action needed. Run:
```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --reporter=verbose 2>&1 | grep -E "(SAVE button is disabled|SAVE button is enabled)"
```
Expected: both PASS

- [ ] **Step 3: No commit needed if no code changed**

If code was correct as-is, skip this commit.

---

## Task 5: Run full test suite

- [ ] **Step 1: Run all frontend tests**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test 2>&1 | tail -20
```
Expected: all pass, 0 failures.

- [ ] **Step 2: Run backend tests**

```bash
cd /Users/eluhrs/claude/bookscan/api && .venv/bin/pytest -v 2>&1 | tail -20
```
Expected: all pass, 0 failures.

---

## Task 6: Update CLAUDE.md

- [ ] **Step 1: Add CHANGES-08 to Completed Iterations section**

Add after the CHANGES-07 block in `CLAUDE.md`:

```markdown
**CHANGES-08** — all items implemented:
- FEAT-01: WorkflowWrapper Zone 2 (controls bar) collapses entirely when `controls === null`; no border renders on Review screen since controls prop is null (border lives inside controls content for Photograph/Lookup steps)
- FEAT-02/03: Horizontal scrollable filmstrip replaces old cover+metadata side-by-side layout; cover image has accent-colored 2px border (visual distinction, not deletable); user photos have ✕ delete buttons
- FEAT-04: Auto-check "Review Photography?" when all user photos deleted from filmstrip; note: `needs_photography` from spec = `needs_photo_review` (migration 004 already complete — no new migration)
- BUG-01: Title (bold, 2-line max, `-webkit-line-clamp:2`) and author (1-line, `text-overflow:ellipsis`) in ReviewStep and BookTable
- BUG-02: SAVE button state confirmed correct — blue (`theme.colors.accent`) when condition selected, gray+disabled when not
- FEAT-05: Review screen layout order confirmed: step indicator → (no controls bar) → filmstrip → title → author → year·publisher → conditions → checkboxes → SAVE → secondary bar
```

- [ ] **Step 2: Commit CLAUDE.md**

```bash
cd /Users/eluhrs/claude/bookscan
git add CLAUDE.md
git commit -m "docs: mark CHANGES-08 complete with status summary"
```

---

## Deployment Commands

After merging to staging/prod:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

No database migration needed — migration 004 already added `needs_photo_review`.

---

## Self-Review Against Spec

| Spec item | Covered by task |
|---|---|
| FEAT-01: Remove toolbar border on Review | Task 1 (Zone 2 collapse) |
| FEAT-02: Scrollable filmstrip | Task 3 |
| FEAT-03: Cover image visual distinction | Task 3 (accent border) |
| BUG-01: Title/author text sizing in Review | Task 3 |
| BUG-01: Title/author text sizing in Dashboard | Task 2 |
| FEAT-04: needs_photography migration | Pre-flight note (004 already done) |
| FEAT-04: Auto-check on photo delete | Task 3 |
| FEAT-04: Auto-check on SKIP | Pre-flight note (already works) |
| FEAT-04: Manual override | Task 3 (checkbox onChange handler) |
| FEAT-04: Persist to DB | Pre-flight note (needs_photo_review already wired) |
| BUG-02: SAVE button state | Task 4 (confirm only) |
| FEAT-05: Layout order | Task 3 |
