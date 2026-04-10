# CHANGES-12: Book Edit Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard book edit page's plain form with a structured card layout featuring inline editing, a filmstrip with photo add/delete, and a subject-field removal.

**Architecture:** A new `BookEditCard` component replaces `BookForm` on the dashboard edit page. It owns all inline-edit draft state and commits to the DB via `onSave`/`onImmediateSave` callbacks in `DashboardPage`. `PhotoFilmstrip` gains an optional `onAddPhoto` prop for the `+` placeholder. Subject is removed from all layers (DB migration, models, schemas, routers, services, frontend types, components, tests).

**Tech Stack:** React 18, TypeScript strict, inline styles with `theme.colors.*`, FastAPI + SQLAlchemy 2.0 async, Alembic migrations.

---

## File Map

**Create:**
- `api/alembic/versions/005_drop_subject.py` — Alembic migration to DROP COLUMN subject
- `frontend/src/components/BookEditCard.tsx` — New structured card layout component
- `frontend/src/__tests__/BookEditCard.test.tsx` — Tests for BookEditCard

**Modify:**
- `api/app/models.py` — Remove `subject` mapped column from Book
- `api/app/schemas.py` — Remove `subject` from BookLookupResponse, BookCreate, BookUpdate, BookResponse
- `api/app/routers/books.py` — Remove `subject=book_data.subject` / `subject=book.subject` / `subject=b.subject` from all constructors
- `api/app/routers/listings.py` — Remove subject from listing text generator and CSV export
- `api/app/services/lookup.py` — Remove `subject` from BookData dataclass, OL/GB fetch logic, and merge pick
- `api/tests/test_listings.py` — Remove `subject=` from `make_book()` defaults
- `frontend/src/types.ts` — Remove `subject` from `Book` and `BookLookup`
- `frontend/src/components/PhotoFilmstrip.tsx` — Add `onAddPhoto?: (file: File) => void` prop and `+` placeholder; change ✕ button to danger color
- `frontend/src/pages/DashboardPage.tsx` — Replace BookForm+filmstrip+download with BookEditCard; adapt save handlers; add handleAddPhoto
- `frontend/src/__tests__/BookTable.test.tsx` — Remove `subject: null` from mock book
- `frontend/src/__tests__/listingText.test.tsx` — Remove `subject: null` from mock book
- `frontend/src/__tests__/workflow/LookupStep.test.tsx` — Remove `subject: null` from mock lookup
- `frontend/src/__tests__/workflow/ReviewStep.test.tsx` — Remove `subject: null` from mock

**Delete:**
- `frontend/src/components/BookForm.tsx` — Replaced by BookEditCard
- `frontend/src/__tests__/BookForm.test.tsx` — Tests the deleted component

---

## Task 1: Backend — Alembic migration to drop subject

**Files:**
- Create: `api/alembic/versions/005_drop_subject.py`

- [ ] **Step 1: Write the migration**

```python
# api/alembic/versions/005_drop_subject.py
"""drop subject column from books

Revision ID: 005
Revises: 004
Create Date: 2026-04-09
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("books", "subject")


def downgrade() -> None:
    import sqlalchemy as sa
    op.add_column("books", sa.Column("subject", sa.Text, nullable=True))
```

- [ ] **Step 2: Commit**

```bash
git add api/alembic/versions/005_drop_subject.py
git commit -m "feat: migration 005 — drop subject column from books"
```

---

## Task 2: Backend — Remove subject from models, schemas, routers, services

**Files:**
- Modify: `api/app/models.py`
- Modify: `api/app/schemas.py`
- Modify: `api/app/routers/books.py`
- Modify: `api/app/routers/listings.py`
- Modify: `api/app/services/lookup.py`
- Modify: `api/tests/test_listings.py`

- [ ] **Step 1: Remove subject from models.py**

In `api/app/models.py`, delete the line:
```python
    subject: Mapped[str | None] = mapped_column(Text)
```

- [ ] **Step 2: Remove subject from all four schemas in schemas.py**

In `api/app/schemas.py`, remove `subject: Optional[str] = None` from:
- `BookLookupResponse` (line 24)
- `BookCreate` (line 41)
- `BookUpdate` (line 59)
- `BookResponse` (line 87)

- [ ] **Step 3: Remove subject from routers/books.py**

In `api/app/routers/books.py`, remove these three lines (each is a `subject=...` argument inside a `BookResponse(...)` or `lookup_book` constructor):
- Line 50: `subject=book_data.subject,`
- Line 89: `subject=book.subject,`
- Line 160: `subject=b.subject,`

- [ ] **Step 4: Remove subject from routers/listings.py**

In `api/app/routers/listings.py`:

Remove `("Subject", book.subject),` from the `generate_listing_text()` function (line 32).

In the CSV writer (around lines 91–100), change:
```python
writer.writerow([
    "title", "author", "publisher", "edition", "year", "pages",
    "dimensions", "weight", "subject", "description", "condition",
    "isbn", "listing_text", "created_at", "ebay_status",
])
```
to:
```python
writer.writerow([
    "title", "author", "publisher", "edition", "year", "pages",
    "dimensions", "weight", "description", "condition",
    "isbn", "listing_text", "created_at", "ebay_status",
])
```

And the data row:
```python
b.title, b.author, b.publisher, b.edition, b.year, b.pages,
b.dimensions, b.weight, b.subject, b.description, b.condition,
```
to:
```python
b.title, b.author, b.publisher, b.edition, b.year, b.pages,
b.dimensions, b.weight, b.description, b.condition,
```

- [ ] **Step 5: Remove subject from services/lookup.py**

In `api/app/services/lookup.py`:

1. Remove `subject: Optional[str] = None` from the `BookData` dataclass (line 21).

2. In `fetch_open_library`, remove the subjects block (lines 60–63):
```python
        subjects = book.get("subjects", [])
        if subjects:
            result.subject = subjects[0].get("name") if isinstance(subjects[0], dict) else subjects[0]
            result.data_sources["subject"] = "open_library"
```

3. In `fetch_google_books` (around lines 104–105), remove:
```python
            result.subject = categories[0]
            result.data_sources["subject"] = "google_books"
```
and the `categories` extraction that feeds it (the `if info.get("categories"):` block).

4. In the merge function (around line 209), remove:
```python
    pick("subject", ol, gb, loc)
```

5. Update the docstring around line 187 to remove "subject" from the "pages, subject: first non-null wins" line.

- [ ] **Step 6: Remove subject from test_listings.py**

In `api/tests/test_listings.py`, remove `subject="Software Engineering",` from `make_book()` defaults.

- [ ] **Step 7: Run backend tests**

```bash
cd /Users/eluhrs/claude/bookscan/api && .venv/bin/pytest -v
```

Expected: all tests pass. If any test references `subject`, fix it.

- [ ] **Step 8: Commit**

```bash
git add api/app/models.py api/app/schemas.py api/app/routers/books.py api/app/routers/listings.py api/app/services/lookup.py api/tests/test_listings.py
git commit -m "feat: remove subject field from backend models, schemas, routers, and services"
```

---

## Task 3: Frontend — Remove subject from types and all test fixtures

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/__tests__/BookTable.test.tsx`
- Modify: `frontend/src/__tests__/listingText.test.tsx`
- Modify: `frontend/src/__tests__/workflow/LookupStep.test.tsx`
- Modify: `frontend/src/__tests__/workflow/ReviewStep.test.tsx`

- [ ] **Step 1: Remove subject from types.ts**

In `frontend/src/types.ts`, remove `subject: string | null` from both `Book` (line 12) and `BookLookup` (line 42).

- [ ] **Step 2: Remove subject from BookTable.test.tsx**

In `frontend/src/__tests__/BookTable.test.tsx`, remove `subject: null,` from the mock book object.

- [ ] **Step 3: Remove subject from listingText.test.tsx**

In `frontend/src/__tests__/listingText.test.tsx`, remove `subject: null,` from the `mockBook` object (line 31).

- [ ] **Step 4: Remove subject from LookupStep.test.tsx**

In `frontend/src/__tests__/workflow/LookupStep.test.tsx`, remove `subject: null,` from the mock lookup result (line 97).

- [ ] **Step 5: Remove subject from ReviewStep.test.tsx**

In `frontend/src/__tests__/workflow/ReviewStep.test.tsx`, remove `subject: null,` from the mock (line 17).

- [ ] **Step 6: Run frontend tests**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --run
```

Expected: all tests pass (BookForm.test.tsx will still pass at this point — it references `BookLookup` which no longer has `subject`, but BookForm still has `subject` in TEXT_FIELDS; TypeScript will catch this. If tsc errors appear, fix BookForm.tsx by removing subject from TEXT_FIELDS now.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/__tests__/
git commit -m "feat: remove subject field from frontend types and test fixtures"
```

---

## Task 4: Update PhotoFilmstrip — add onAddPhoto prop and danger-color ✕ button

**Files:**
- Modify: `frontend/src/components/PhotoFilmstrip.tsx`

- [ ] **Step 1: Update PhotoFilmstrip**

Replace the full contents of `frontend/src/components/PhotoFilmstrip.tsx` with:

```tsx
// frontend/src/components/PhotoFilmstrip.tsx

import { useRef } from 'react'
import { theme } from '../styles/theme'

const FILMSTRIP_HEIGHT = 120
const COVER_WIDTH = Math.round(FILMSTRIP_HEIGHT * (2 / 3))  // 80px — 2:3 portrait
const PHOTO_WIDTH = Math.round(FILMSTRIP_HEIGHT * (3 / 4))  // 90px — 4:3 landscape

interface PhotoFilmstripProps {
  /** Cover image URL from metadata lookup. null shows a placeholder. Not deletable. */
  coverUrl: string | null
  /** User-uploaded photos as { key, url } pairs. key is passed to onDelete. */
  photos: Array<{ key: string; url: string }>
  /** Called with the photo's key when the user taps the ✕ delete button. */
  onDelete: (key: string) => void
  /** When provided, renders a + placeholder at the end that opens a file picker. */
  onAddPhoto?: (file: File) => void
}

export default function PhotoFilmstrip({ coverUrl, photos, onDelete, onAddPhoto }: PhotoFilmstripProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        padding: '0.75rem 1rem',
        flexShrink: 0,
        background: theme.colors.subtle,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Cover image — accent border signals lookup result, not deletable */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {coverUrl ? (
          <img
            src={coverUrl}
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

      {/* User photos — with ✕ delete button */}
      {photos.map((photo, i) => (
        <div key={photo.key} style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={photo.url}
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
            onClick={() => onDelete(photo.key)}
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: theme.colors.danger,
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

      {/* + placeholder — shown when onAddPhoto is provided */}
      {onAddPhoto && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                onAddPhoto(file)
                e.target.value = ''
              }
            }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Add photo"
            style={{
              width: PHOTO_WIDTH,
              height: FILMSTRIP_HEIGHT,
              flexShrink: 0,
              border: `2px dashed ${theme.colors.border}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: theme.colors.muted,
              fontSize: '1.75rem',
              fontWeight: 300,
              userSelect: 'none',
            }}
          >
            +
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run frontend tests**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --run
```

Expected: all tests pass (no tests directly assert button color).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PhotoFilmstrip.tsx
git commit -m "feat: add onAddPhoto prop and + placeholder to PhotoFilmstrip; danger-color ✕ button"
```

---

## Task 5: Write failing tests for BookEditCard

**Files:**
- Create: `frontend/src/__tests__/BookEditCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/__tests__/BookEditCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import BookEditCard from '../components/BookEditCard'
import { Book, BookPhoto } from '../types'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    isbn: '9780134757599',
    title: 'Refactoring',
    author: 'Martin Fowler',
    publisher: 'Addison-Wesley',
    edition: '2nd ed.',
    year: 2018,
    pages: 448,
    dimensions: null,
    weight: null,
    description: 'Improving the design of existing code.',
    condition: 'Good',
    cover_image_url: null,
    cover_image_local: null,
    data_sources: null,
    data_complete: true,
    has_photos: false,
    needs_photo_review: false,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

describe('BookEditCard', () => {
  const noOp = vi.fn().mockResolvedValue(undefined)

  it('renders title and author', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByText('Refactoring')).toBeInTheDocument()
    expect(screen.getByText('Martin Fowler')).toBeInTheDocument()
  })

  it('renders condition dropdown with all options', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const select = screen.getByRole('combobox')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'])
  })

  it('Review Metadata checkbox reflects !data_complete', () => {
    render(
      <BookEditCard
        book={makeBook({ data_complete: false })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const checkbox = screen.getByLabelText('Review Metadata?') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('Review Photography checkbox reflects needs_photo_review', () => {
    render(
      <BookEditCard
        book={makeBook({ needs_photo_review: true })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const checkbox = screen.getByLabelText('Review Photography?') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('calls onImmediateSave with data_complete false when Review Metadata is checked', async () => {
    const onImmediateSave = vi.fn().mockResolvedValue(undefined)
    render(
      <BookEditCard
        book={makeBook({ data_complete: true })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={onImmediateSave}
        onGenerateListing={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText('Review Metadata?'))
    expect(onImmediateSave).toHaveBeenCalledWith({ data_complete: false })
  })

  it('shows em dash for empty description', () => {
    render(
      <BookEditCard
        book={makeBook({ description: null })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders Save Changes and Generate Listing buttons', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate listing/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --run --reporter=verbose 2>&1 | grep -E "BookEditCard|FAIL|Error"
```

Expected: failures because `BookEditCard` does not exist yet.

---

## Task 6: Create BookEditCard component

**Files:**
- Create: `frontend/src/components/BookEditCard.tsx`

- [ ] **Step 1: Create BookEditCard.tsx**

```tsx
// frontend/src/components/BookEditCard.tsx

import { useState, useEffect, useRef } from 'react'
import { Book, BookPhoto } from '../types'
import { theme } from '../styles/theme'
import PhotoFilmstrip from './PhotoFilmstrip'

interface BookEditCardProps {
  book: Book
  photos: BookPhoto[]
  photoUrls: Record<string, string>
  onDeletePhoto: (photoId: string) => Promise<void>
  onAddPhoto: (file: File) => Promise<void>
  onSave: (updates: Partial<Book>) => Promise<void>
  onImmediateSave: (updates: Partial<Book>) => Promise<void>
  onGenerateListing: () => void
}

interface DraftFields {
  title: string | null
  author: string | null
  isbn: string
  pages: number | null
  publisher: string | null
  edition: string | null
  dimensions: string | null
  weight: string | null
  description: string | null
  condition: string | null
}

const CONDITIONS = ['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const

const SMALL_CAPS_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: theme.colors.muted,
  marginBottom: 2,
}

const FIELD_VALUE: React.CSSProperties = {
  fontSize: 13,
  color: theme.colors.subtleText,
  lineHeight: 1.4,
}

const EMPTY_VALUE: React.CSSProperties = {
  fontSize: 13,
  color: theme.colors.muted,
  fontStyle: 'italic',
}

// ---- InlineField ----
// Single-field inline edit: display span ↔ input on click/blur
interface InlineFieldProps {
  value: string | number | null
  onChange: (v: string) => void
  fontSize?: number
  fontWeight?: number
  color?: string
  mono?: boolean
  multiline?: boolean
}

function InlineField({
  value,
  onChange,
  fontSize = 13,
  fontWeight = 400,
  color = theme.colors.subtleText,
  mono = false,
  multiline = false,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value))
  const [hovered, setHovered] = useState(false)

  // Sync local state when parent value changes (e.g. after save)
  useEffect(() => {
    setLocal(value === null || value === undefined ? '' : String(value))
  }, [value])

  const displayStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color: local ? color : theme.colors.muted,
    fontStyle: local ? 'normal' : 'italic',
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    cursor: 'text',
    display: 'block',
    minHeight: '1.4em',
    padding: '1px 3px',
    borderRadius: 3,
    border: hovered ? `0.5px solid ${theme.colors.border}` : '0.5px solid transparent',
    lineHeight: 1.4,
  }

  const inputStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color,
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    width: '100%',
    padding: '1px 3px',
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: 3,
    outline: 'none',
    resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 80 : undefined,
    lineHeight: 1.4,
    boxSizing: 'border-box',
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          value={local}
          style={inputStyle}
          autoFocus
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            setEditing(false)
            onChange(local)
          }}
        />
      )
    }
    return (
      <input
        type="text"
        value={local}
        style={inputStyle}
        autoFocus
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onChange(local)
        }}
      />
    )
  }

  return (
    <span
      style={displayStyle}
      onClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {local || '—'}
    </span>
  )
}

// ---- BookEditCard ----
export default function BookEditCard({
  book,
  photos,
  photoUrls,
  onDeletePhoto,
  onAddPhoto,
  onSave,
  onImmediateSave,
  onGenerateListing,
}: BookEditCardProps) {
  const [draft, setDraft] = useState<DraftFields>({
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    pages: book.pages,
    publisher: book.publisher,
    edition: book.edition,
    dimensions: book.dimensions,
    weight: book.weight,
    description: book.description,
    condition: book.condition,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync draft when book prop updates (e.g. after immediate save refreshes parent)
  useEffect(() => {
    setDraft({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      pages: book.pages,
      publisher: book.publisher,
      edition: book.edition,
      dimensions: book.dimensions,
      weight: book.weight,
      description: book.description,
      condition: book.condition,
    })
  }, [book.id])

  function setField<K extends keyof DraftFields>(key: K, raw: string) {
    setDraft((d) => ({
      ...d,
      [key]: key === 'pages'
        ? (raw ? Number(raw) : null)
        : (raw || null),
    }))
  }

  async function handleSaveChanges() {
    setSaving(true)
    setError('')
    try {
      await onSave(draft as Partial<Book>)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleMetadataCheck(checked: boolean) {
    await onImmediateSave({ data_complete: !checked })
  }

  async function handlePhotographyCheck(checked: boolean) {
    await onImmediateSave({ needs_photo_review: checked })
  }

  const addedDate = new Date(book.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        background: theme.colors.surface,
        fontFamily: theme.font.sans,
      }}
    >
      {/* Zone 1: Filmstrip */}
      <PhotoFilmstrip
        coverUrl={book.cover_image_url}
        photos={photos.map((p) => ({ key: p.id, url: photoUrls[p.id] ?? '' }))}
        onDelete={onDeletePhoto}
        onAddPhoto={onAddPhoto}
      />

      <div style={{ padding: '1rem' }}>
        {/* Zone 2: Title / Author / Status — two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          {/* Left: Title, Author, Year · Publisher */}
          <div>
            <div style={{ marginBottom: 4 }}>
              <InlineField
                value={draft.title}
                onChange={(v) => setField('title', v)}
                fontSize={20}
                fontWeight={500}
                color={theme.colors.text}
              />
            </div>
            <div style={{ marginBottom: 4 }}>
              <InlineField
                value={draft.author}
                onChange={(v) => setField('author', v)}
                fontSize={15}
                color={theme.colors.muted}
              />
            </div>
            <div style={{ fontSize: 13, color: theme.colors.muted, paddingLeft: 3 }}>
              {[book.year, book.publisher].filter(Boolean).join(' · ') || <em>—</em>}
            </div>
          </div>

          {/* Right: Condition, Review Metadata?, Review Photography? */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <select
              value={draft.condition ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, condition: e.target.value || null }))}
              style={{
                width: '100%',
                padding: '0.3rem 0.4rem',
                fontSize: 13,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                fontFamily: theme.font.sans,
                background: theme.colors.bg,
                color: theme.colors.text,
              }}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c || '— condition —'}</option>
              ))}
            </select>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: 13,
                color: theme.colors.text,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <input
                type="checkbox"
                aria-label="Review Metadata?"
                checked={!book.data_complete}
                onChange={(e) => handleMetadataCheck(e.target.checked)}
              />
              Review Metadata?
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: 13,
                color: theme.colors.text,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <input
                type="checkbox"
                aria-label="Review Photography?"
                checked={book.needs_photo_review}
                onChange={(e) => handlePhotographyCheck(e.target.checked)}
              />
              Review Photography?
            </label>
          </div>
        </div>

        {/* Zone 3: Core fields — ISBN, Pages, Publisher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            paddingBottom: '1.25rem',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {([
            { key: 'isbn', label: 'ISBN', mono: true },
            { key: 'pages', label: 'Pages' },
            { key: 'publisher', label: 'Publisher' },
          ] as const).map(({ key, label, mono }) => (
            <div key={key}>
              <span style={SMALL_CAPS_LABEL}>{label}</span>
              <InlineField
                value={draft[key]}
                onChange={(v) => setField(key, v)}
                mono={mono}
              />
            </div>
          ))}
        </div>

        {/* Zone 4: Description */}
        <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: `1px solid ${theme.colors.border}` }}>
          <span style={SMALL_CAPS_LABEL}>Description</span>
          <InlineField
            value={draft.description}
            onChange={(v) => setField('description', v)}
            multiline
            fontSize={13}
            color={theme.colors.muted}
          />
        </div>

        {/* Zone 5: Additional fields — Edition, Dimensions, Weight */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            paddingBottom: '1.25rem',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {([
            { key: 'edition', label: 'Edition' },
            { key: 'dimensions', label: 'Dimensions' },
            { key: 'weight', label: 'Weight' },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <span style={SMALL_CAPS_LABEL}>{label}</span>
              <InlineField
                value={draft[key]}
                onChange={(v) => setField(key, v)}
              />
            </div>
          ))}
        </div>

        {/* Zone 6: Footer */}
        {error && (
          <p style={{ color: theme.colors.danger, fontSize: 13, marginBottom: '0.5rem' }}>
            {error}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: theme.colors.muted }}>
            added {addedDate}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onGenerateListing}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: 13,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                background: theme.colors.bg,
                cursor: 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              generate listing
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                borderRadius: theme.radius.sm,
                background: saving ? theme.colors.muted : theme.colors.accent,
                color: '#fff',
                cursor: saving ? 'default' : 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              {saving ? 'Saving…' : 'save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run frontend tests**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --run
```

Expected: all BookEditCard tests pass; all other tests still pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BookEditCard.tsx frontend/src/__tests__/BookEditCard.test.tsx
git commit -m "feat: add BookEditCard component with inline editing and photo management"
```

---

## Task 7: Update DashboardPage — replace BookForm with BookEditCard

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Rewrite the DashboardPage edit view**

Replace the entire `if (editingBook)` block and import section in `DashboardPage.tsx`.

Change the imports at the top:
```tsx
import BookEditCard from '../components/BookEditCard'
// Remove: import BookForm from '../components/BookForm'
```

Replace `handleEdit` with two new handlers:

```tsx
  async function handleSave(updates: Partial<Book>) {
    if (!editingBook) return
    const updated = await updateBook(editingBook.id, updates)
    setEditingBook(updated)
    load()
  }

  async function handleImmediateSave(updates: Partial<Book>) {
    if (!editingBook) return
    const updated = await updateBook(editingBook.id, updates)
    setEditingBook(updated)
  }
```

Replace `handleDeletePhoto`:
```tsx
  async function handleDeletePhoto(photoId: string) {
    if (!window.confirm('Delete this photo?')) return
    try {
      await deletePhoto(photoId)
      if (photoUrls[photoId]) URL.revokeObjectURL(photoUrls[photoId])
      setPhotoUrls((prev) => { const next = { ...prev }; delete next[photoId]; return next })
      setBookPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }
```

Add `handleAddPhoto` after `handleDeletePhoto`:
```tsx
  async function handleAddPhoto(file: File) {
    if (!editingBook) return
    try {
      await uploadPhotos(editingBook.id, [file])
      // Re-fetch all photos and their URLs
      const allPhotos = await listPhotos(editingBook.id)
      setBookPhotos(allPhotos)
      // Revoke old blob URLs, create new ones
      setPhotoUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
        return {}
      })
      const urls: Record<string, string> = {}
      await Promise.all(
        allPhotos.map(async (p) => {
          try {
            urls[p.id] = await getPhotoUrl(p.id)
          } catch {
            // photo not found — skip
          }
        })
      )
      setPhotoUrls(urls)
      setEditingBook((prev) => prev ? { ...prev, has_photos: true } : null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    }
  }
```

Add `uploadPhotos` to the photos import:
```tsx
import { listPhotos, deletePhoto, getPhotoUrl, downloadPhotosZip, uploadPhotos } from '../api/photos'
```

Replace the entire `if (editingBook)` return block:
```tsx
  if (editingBook) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: '2rem auto',
          padding: '0 1rem',
          fontFamily: theme.font.sans,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <button
            onClick={() => setEditingBook(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.colors.muted,
              fontSize: '1rem',
              padding: 0,
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Edit Book</h2>
        </div>

        <BookEditCard
          book={editingBook}
          photos={bookPhotos}
          photoUrls={photoUrls}
          onDeletePhoto={handleDeletePhoto}
          onAddPhoto={handleAddPhoto}
          onSave={handleSave}
          onImmediateSave={handleImmediateSave}
          onGenerateListing={() => setListingBook(editingBook)}
        />
      </div>
    )
  }
```

Also remove `downloadPhotosZip` from the photos import (no longer used in DashboardPage since the download button is removed from the edit view):

Check if `downloadPhotosZip` is still needed. If it's only called from the old edit view, remove it from the import. If the listing generator component uses it, leave it. (The listing generator imports it directly from `api/photos`, so it's safe to remove from DashboardPage.)

Remove `downloadPhotosZip` from DashboardPage imports:
```tsx
import { listPhotos, deletePhoto, getPhotoUrl, uploadPhotos } from '../api/photos'
```

Remove `handleEdit` function and the `asLookup` conversion (no longer needed).

- [ ] **Step 2: Run frontend tests**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: replace BookForm with BookEditCard on dashboard edit page"
```

---

## Task 8: Delete BookForm and its test; fix any TypeScript errors

**Files:**
- Delete: `frontend/src/components/BookForm.tsx`
- Delete: `frontend/src/__tests__/BookForm.test.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm /Users/eluhrs/claude/bookscan/frontend/src/components/BookForm.tsx
rm /Users/eluhrs/claude/bookscan/frontend/src/__tests__/BookForm.test.tsx
```

- [ ] **Step 2: Check TypeScript for errors**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npx tsc --noEmit 2>&1 | head -40
```

Fix any errors found (e.g. stale `subject` references, missing imports).

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/eluhrs/claude/bookscan/frontend && npm run test -- --run
```

Expected: all tests pass.

- [ ] **Step 4: Run backend tests**

```bash
cd /Users/eluhrs/claude/bookscan/api && .venv/bin/pytest -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: delete BookForm component and tests (replaced by BookEditCard)"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task covering it |
|---|---|
| Filmstrip reuse, cover accent border, ✕ delete | Task 4 (PhotoFilmstrip), Task 6 (BookEditCard Zone 1) |
| + placeholder opens file picker | Task 4 (PhotoFilmstrip onAddPhoto prop) |
| No download button on edit page | Task 7 (DashboardPage — removed) |
| Photo delete with confirmation | Task 7 (DashboardPage handleDeletePhoto) |
| Title 20px inline edit | Task 6 Zone 2 left column |
| Author 15px inline edit | Task 6 Zone 2 left column |
| Year · Publisher display-only | Task 6 Zone 2 left column |
| Condition dropdown full width right column | Task 6 Zone 2 right column |
| Review Metadata? checkbox immediate save | Task 6 + Task 7 handleImmediateSave |
| Review Photography? checkbox immediate save | Task 6 + Task 7 handleImmediateSave |
| Zone 3: ISBN/Pages/Publisher inline edit | Task 6 Zone 3 |
| Zone 4: Description full-width textarea | Task 6 Zone 4 |
| Zone 5: Edition/Dimensions/Weight inline edit | Task 6 Zone 5 |
| Empty fields show em dash italic | InlineField component |
| Hover shows 0.5px border | InlineField hovered state |
| Zone 6 footer: added date, generate listing, save changes | Task 6 Zone 6 |
| Save Changes commits all pending edits | Task 6 handleSaveChanges + Task 7 handleSave |
| Save Changes does NOT affect checkboxes | Task 6 (checkboxes call onImmediateSave independently) |
| Drop subject column (DB migration) | Task 1 |
| Remove subject from all backend code | Task 2 |
| Remove subject from frontend | Task 3 |

### No Placeholders — confirmed: all steps contain actual code.

### Type consistency:
- `DraftFields` defined in Task 6, used consistently throughout BookEditCard
- `onSave: (updates: Partial<Book>) => Promise<void>` — `Partial<Book>` from `types.ts`
- `onImmediateSave` same signature as `onSave`
- `handleSave` and `handleImmediateSave` in DashboardPage both call `updateBook(id, updates)` returning `Book`
- `PhotoFilmstrip.onAddPhoto?: (file: File) => void` — `File` is native DOM type
