# Photo Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-screen scan flow with a three-step Photograph → Lookup → Review workflow that captures physical book photos before saving.

**Architecture:** A shared `WorkflowWrapper` component owns the consistent six-zone page layout (header, progress, controls, main content, primary button, cancel). Three step components (`PhotographStep`, `LookupStep`, `ReviewStep`) render their own controls and content inside it. `PhotoWorkflowPage` holds all state and orchestrates transitions. Backend gains a `book_photos` table with four photo endpoints.

**Tech Stack:** React 18 / TypeScript / Vite / Vitest / @testing-library/react — FastAPI / SQLAlchemy 2.0 async / Alembic / PostgreSQL 15 / Docker Compose

---

## Task 1: Create feature branch

**Files:** none

- [ ] **Step 1: Create and check out the feature branch**

```bash
git checkout -b feat/photo-workflow
git status
```
Expected: On branch feat/photo-workflow, nothing to commit.

- [ ] **Step 2: Commit**

Nothing to commit — branch creation only. Proceed to Task 2.

---

## Task 2: BookPhoto model + migration 003

**Files:**
- Modify: `api/app/models.py`
- Create: `api/alembic/versions/003_add_book_photos.py`
- Modify: `docker-compose.yml` (photos volume)
- Modify: `docker-compose.dev.yml` (photos volume)

- [ ] **Step 1: Add BookPhoto model to `api/app/models.py`**

Add after the `Listing` class (and add `photos` relationship to `Book`):

```python
# At top of file, existing imports already have everything needed

class Book(Base):
    # ... all existing fields unchanged ...
    listings: Mapped[list["Listing"]] = relationship(back_populates="book", passive_deletes=True)
    photos: Mapped[list["BookPhoto"]] = relationship(back_populates="book", passive_deletes=True)


# Add at end of file:
class BookPhoto(Base):
    __tablename__ = "book_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE")
    )
    filename: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    book: Mapped["Book"] = relationship(back_populates="photos")
```

- [ ] **Step 2: Create migration `api/alembic/versions/003_add_book_photos.py`**

```python
"""add book_photos table

Revision ID: 003
Revises: 002
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "book_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_book_photos_book_id", "book_photos", ["book_id"])


def downgrade() -> None:
    op.drop_index("ix_book_photos_book_id", table_name="book_photos")
    op.drop_table("book_photos")
```

- [ ] **Step 3: Add `photos` volume to `docker-compose.yml`**

In `api` service `volumes`, add:
```yaml
      - photos:/app/photos
```

In `volumes` section, add:
```yaml
  photos:
```

Full volumes section after change:
```yaml
volumes:
  postgres_data:
  covers:
  photos:
```

- [ ] **Step 4: Add `photos` volume to `docker-compose.dev.yml`**

In `api` service `volumes`, add:
```yaml
      - photos:/app/photos
```

In `volumes` section, add:
```yaml
  photos:
```

Full dev volumes section after change:
```yaml
volumes:
  covers:
  photos:
```

- [ ] **Step 5: Verify model is importable**

```bash
cd api && .venv/bin/python -c "from app.models import BookPhoto; print('OK')"
```
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add api/app/models.py api/alembic/versions/003_add_book_photos.py docker-compose.yml docker-compose.dev.yml
git commit -m "feat: add BookPhoto model and migration 003"
```

---

## Task 3: Backend schemas + has_photos in books router

**Files:**
- Modify: `api/app/schemas.py`
- Modify: `api/app/routers/books.py`

- [ ] **Step 1: Add `BookPhotoResponse` and update `BookResponse` in `api/app/schemas.py`**

Add `BookPhotoResponse` **before** `BookResponse` in the file (required for the forward reference). Also add `has_photos` and `photos` to `BookResponse`:

```python
# Add this class before BookResponse:
class BookPhotoResponse(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    filename: str
    created_at: datetime

    model_config = {"from_attributes": True}


# In BookResponse, add two new fields at the end (before model_config):
class BookResponse(BaseModel):
    id: uuid.UUID
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    pages: Optional[int] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    cover_image_local: Optional[str] = None
    data_sources: Optional[dict] = None
    data_complete: bool
    condition: Optional[str] = None
    has_photos: bool = False
    photos: list[BookPhotoResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Update `list_books` in `api/app/routers/books.py` to compute `has_photos`**

Add `BookPhoto` to the imports at the top:
```python
from app.models import Book, BookPhoto
```

Replace the return statement in `list_books` with a batch `has_photos` computation:

```python
@router.get("", response_model=BookListResponse)
async def list_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    incomplete_only: bool = Query(False),
    search: Optional[str] = Query(None),
):
    q = select(Book)
    if incomplete_only:
        q = q.where(Book.data_complete == False)  # noqa: E712
    if search:
        term = f"%{search}%"
        q = q.where(
            Book.title.ilike(term)
            | Book.author.ilike(term)
            | Book.isbn.ilike(term)
        )
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    q = q.order_by(Book.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    books = (await db.scalars(q)).all()

    # Batch check which books have photos (single IN query, no N+1)
    book_ids = [b.id for b in books]
    photo_book_ids: set = set()
    if book_ids:
        rows = await db.scalars(
            select(BookPhoto.book_id)
            .where(BookPhoto.book_id.in_(book_ids))
            .distinct()
        )
        photo_book_ids = set(rows.all())

    items = [
        BookResponse.model_validate(b).model_copy(update={"has_photos": b.id in photo_book_ids})
        for b in books
    ]
    return BookListResponse(items=items, total=total, page=page, page_size=page_size)
```

Add `BookResponse` to the schemas import (it's already there but confirm it's imported):
```python
from app.schemas import (
    BookCreate,
    BookListResponse,
    BookLookupResponse,
    BookResponse,
    BookUpdate,
)
```

- [ ] **Step 3: Update `get_book` in `api/app/routers/books.py` to load photos**

Add `selectinload` to the imports at top:
```python
from sqlalchemy.orm import selectinload
```

Replace the `get_book` handler:
```python
@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    stmt = (
        select(Book)
        .where(Book.id == book_id)
        .options(selectinload(Book.photos))
    )
    result = await db.execute(stmt)
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    from app.schemas import BookPhotoResponse
    resp = BookResponse.model_validate(book)
    return resp.model_copy(update={
        "has_photos": len(book.photos) > 0,
        "photos": [BookPhotoResponse.model_validate(p) for p in book.photos],
    })
```

- [ ] **Step 4: Run existing backend tests to confirm nothing broke**

```bash
cd api && .venv/bin/pytest tests/ -v
```
Expected: All existing tests pass. The new `has_photos: false` and `photos: []` fields appear in responses but existing assertions only check specific fields, so they're unaffected.

- [ ] **Step 5: Commit**

```bash
git add api/app/schemas.py api/app/routers/books.py
git commit -m "feat: add BookPhotoResponse schema and has_photos to BookResponse"
```

---

## Task 4: Photos router + tests

**Files:**
- Create: `api/app/routers/photos.py`
- Modify: `api/app/main.py`
- Create: `api/tests/test_photos.py`

- [ ] **Step 1: Write the failing tests in `api/tests/test_photos.py`**

```python
import pytest
from pathlib import Path


@pytest.mark.asyncio
async def test_upload_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-001", "title": "Photo Test"}, headers=auth_headers
    )
    assert create.status_code == 201
    book_id = create.json()["id"]

    photo_bytes = b"fake jpeg content"
    resp = await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("test.jpg", photo_bytes, "image/jpeg"))],
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data) == 1
    assert data[0]["book_id"] == book_id

    photo_id = data[0]["id"]
    expected_file = tmp_path / book_id / f"{photo_id}.jpg"
    assert expected_file.exists()
    assert expected_file.read_bytes() == photo_bytes


@pytest.mark.asyncio
async def test_upload_photos_multiple(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-002", "title": "Multi Photo"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    resp = await client.post(
        f"/api/books/{book_id}/photos",
        files=[
            ("files", ("a.jpg", b"aaa", "image/jpeg")),
            ("files", ("b.jpg", b"bbb", "image/jpeg")),
            ("files", ("c.jpg", b"ccc", "image/jpeg")),
        ],
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_upload_photos_nonexistent_book(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    resp = await client.post(
        "/api/books/00000000-0000-0000-0000-000000000000/photos",
        files=[("files", ("x.jpg", b"x", "image/jpeg"))],
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-003", "title": "List Test"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("a.jpg", b"aaa", "image/jpeg"))],
        headers=auth_headers,
    )

    resp = await client.get(f"/api/books/{book_id}/photos", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["book_id"] == book_id


@pytest.mark.asyncio
async def test_delete_photo(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-004", "title": "Delete Test"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    upload = await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("x.jpg", b"xxx", "image/jpeg"))],
        headers=auth_headers,
    )
    photo_id = upload.json()[0]["id"]

    resp = await client.delete(f"/api/photos/{photo_id}", headers=auth_headers)
    assert resp.status_code == 204

    # File should be gone
    expected_file = tmp_path / book_id / f"{photo_id}.jpg"
    assert not expected_file.exists()

    # List should be empty
    list_resp = await client.get(f"/api/books/{book_id}/photos", headers=auth_headers)
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_delete_book_cascades_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-005", "title": "Cascade Test"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("z.jpg", b"zzz", "image/jpeg"))],
        headers=auth_headers,
    )

    del_resp = await client.delete(f"/api/books/{book_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Verify the book is gone (photo rows cascade via FK)
    gone = await client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert gone.status_code == 404


@pytest.mark.asyncio
async def test_get_book_includes_has_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-006", "title": "Has Photos"}, headers=auth_headers
    )
    book_id = create.json()["id"]
    assert create.json()["has_photos"] is False

    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("p.jpg", b"ppp", "image/jpeg"))],
        headers=auth_headers,
    )

    resp = await client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert resp.json()["has_photos"] is True


@pytest.mark.asyncio
async def test_list_books_has_photos_field(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-007", "title": "List Has Photos"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    # Initially no photos
    resp = await client.get("/api/books", headers=auth_headers)
    item = next(i for i in resp.json()["items"] if i["id"] == book_id)
    assert item["has_photos"] is False

    # Upload one
    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("q.jpg", b"qqq", "image/jpeg"))],
        headers=auth_headers,
    )

    resp = await client.get("/api/books", headers=auth_headers)
    item = next(i for i in resp.json()["items"] if i["id"] == book_id)
    assert item["has_photos"] is True
```

- [ ] **Step 2: Run tests — expect failures (router doesn't exist yet)**

```bash
cd api && .venv/bin/pytest tests/test_photos.py -v
```
Expected: `ImportError` or `404` errors — router not yet registered.

- [ ] **Step 3: Create `api/app/routers/photos.py`**

```python
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Book, BookPhoto
from app.schemas import BookPhotoResponse

router = APIRouter(tags=["photos"])

PHOTOS_DIR = Path("/app/photos")


@router.post("/books/{book_id}/photos", response_model=list[BookPhotoResponse], status_code=201)
async def upload_photos(
    book_id: uuid.UUID,
    files: Annotated[list[UploadFile], File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book_dir = PHOTOS_DIR / str(book_id)
    book_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for upload in files:
        photo_id = uuid.uuid4()
        filename = f"{book_id}/{photo_id}.jpg"
        file_path = PHOTOS_DIR / filename
        content = await upload.read()
        file_path.write_bytes(content)

        photo = BookPhoto(id=photo_id, book_id=book_id, filename=filename)
        db.add(photo)
        results.append(photo)

    await db.commit()
    for p in results:
        await db.refresh(p)
    return results


@router.get("/books/{book_id}/photos", response_model=list[BookPhotoResponse])
async def list_photos(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    result = await db.scalars(
        select(BookPhoto)
        .where(BookPhoto.book_id == book_id)
        .order_by(BookPhoto.created_at)
    )
    return result.all()


@router.delete("/photos/{photo_id}", status_code=204)
async def delete_photo(
    photo_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    photo = await db.get(BookPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = PHOTOS_DIR / photo.filename
    if file_path.exists():
        file_path.unlink()

    await db.delete(photo)
    await db.commit()


@router.get("/photos/{photo_id}/file")
async def get_photo_file(
    photo_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    photo = await db.get(BookPhoto, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = PHOTOS_DIR / photo.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(str(file_path), media_type="image/jpeg")
```

- [ ] **Step 4: Register photos router in `api/app/main.py`**

```python
from app.auth import router as auth_router
from app.routers.books import router as books_router
from app.routers.listings import router as listings_router
from app.routers.photos import router as photos_router

app.include_router(auth_router, prefix="/api")
app.include_router(books_router, prefix="/api")
app.include_router(listings_router, prefix="/api")
app.include_router(photos_router, prefix="/api")
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd api && .venv/bin/pytest tests/test_photos.py -v
```
Expected: All 8 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
cd api && .venv/bin/pytest tests/ -v
```
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add api/app/routers/photos.py api/app/main.py api/tests/test_photos.py
git commit -m "feat: add photos router and test suite"
```

---

## Task 5: Frontend types + photos API client

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/api/photos.ts`

- [ ] **Step 1: Update `frontend/src/types.ts`**

Add `BookPhoto` interface and `has_photos` field to `Book`:

```typescript
export interface Book {
  id: string
  isbn: string
  title: string | null
  author: string | null
  publisher: string | null
  edition: string | null
  year: number | null
  pages: number | null
  dimensions: string | null
  weight: string | null
  subject: string | null
  description: string | null
  condition: string | null
  cover_image_url: string | null
  cover_image_local: string | null
  data_sources: Record<string, string> | null
  data_complete: boolean
  has_photos: boolean
  created_at: string
  updated_at: string
}

export interface BookPhoto {
  id: string
  book_id: string
  filename: string
  created_at: string
}

// BookLookup, Listing, BookListResponse unchanged
```

- [ ] **Step 2: Update `makeBook` helper in `frontend/src/__tests__/BookTable.test.tsx`**

Add `has_photos: false` to the `makeBook` default object (required because TypeScript now requires it):

```typescript
const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: crypto.randomUUID(),
  isbn: '9781234567890',
  title: 'Test Book',
  author: 'Test Author',
  publisher: 'Test Publisher',
  edition: null,
  year: 2020,
  pages: 200,
  dimensions: null,
  weight: null,
  subject: null,
  description: null,
  condition: null,
  cover_image_url: null,
  cover_image_local: null,
  data_sources: null,
  data_complete: true,
  has_photos: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})
```

- [ ] **Step 3: Create `frontend/src/api/photos.ts`**

```typescript
import { apiFetch } from './client'
import { BookPhoto } from '../types'

export async function uploadPhotos(bookId: string, blobs: Blob[]): Promise<BookPhoto[]> {
  const token = localStorage.getItem('token')
  const form = new FormData()
  blobs.forEach((b, i) => form.append('files', b, `photo_${i}.jpg`))
  const resp = await fetch(`/api/books/${bookId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: form,
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error((detail as { detail?: string }).detail ?? resp.statusText)
  }
  return resp.json() as Promise<BookPhoto[]>
}

export async function listPhotos(bookId: string): Promise<BookPhoto[]> {
  return apiFetch<BookPhoto[]>(`/api/books/${bookId}/photos`)
}

export async function deletePhoto(photoId: string): Promise<void> {
  await apiFetch<void>(`/api/photos/${photoId}`, { method: 'DELETE' })
}

export async function getPhotoUrl(photoId: string): Promise<string> {
  const token = localStorage.getItem('token')
  const resp = await fetch(`/api/photos/${photoId}/file`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!resp.ok) throw new Error('Photo not found')
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}
```

- [ ] **Step 4: Update `saveBook` signature in `frontend/src/api/books.ts`**

`has_photos` is now on `Book` but `saveBook` callers pass `BookLookup` which doesn't have it. Add `has_photos` to the Omit:

```typescript
export async function saveBook(
  book: Omit<Book, 'id' | 'cover_image_local' | 'created_at' | 'updated_at' | 'has_photos'>
): Promise<Book> {
  return apiFetch('/api/books', { method: 'POST', body: JSON.stringify(book) })
}
```

- [ ] **Step 5: Run frontend tests to confirm types compile**

```bash
cd frontend && npm run test -- --run
```
Expected: All existing tests pass (TypeScript errors would surface here if types are wrong).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/photos.ts frontend/src/api/books.ts frontend/src/__tests__/BookTable.test.tsx
git commit -m "feat: add BookPhoto type, has_photos to Book, and photos API client"
```

---

## Task 6: WorkflowWrapper component + test

**Files:**
- Create: `frontend/src/components/workflow/WorkflowWrapper.tsx`
- Create: `frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import WorkflowWrapper from '../../components/workflow/WorkflowWrapper'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

const defaultProps = {
  step: 'lookup' as const,
  controls: null,
  primaryLabel: 'LOOKUP',
  onPrimary: vi.fn(),
  onCancel: vi.fn(),
  children: <div>main content</div>,
}

describe('WorkflowWrapper', () => {
  it('marks only the current step with a filled dot', () => {
    render(<WorkflowWrapper {...defaultProps} step="lookup" />, { wrapper })
    expect(screen.getAllByText('●')).toHaveLength(1)
    expect(screen.getAllByText('○')).toHaveLength(2)
  })

  it('labels the steps: Photograph, Lookup, Review', () => {
    render(<WorkflowWrapper {...defaultProps} />, { wrapper })
    expect(screen.getByText('Photograph')).toBeInTheDocument()
    expect(screen.getByText('Lookup')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('renders primary button with the given label', () => {
    render(<WorkflowWrapper {...defaultProps} primaryLabel="CAPTURE" />, { wrapper })
    expect(screen.getByRole('button', { name: 'CAPTURE' })).toBeInTheDocument()
  })

  it('disables primary button when primaryDisabled is true', () => {
    render(<WorkflowWrapper {...defaultProps} primaryDisabled />, { wrapper })
    expect(screen.getByRole('button', { name: 'LOOKUP' })).toBeDisabled()
  })

  it('calls onPrimary when primary button is clicked', () => {
    const onPrimary = vi.fn()
    render(<WorkflowWrapper {...defaultProps} onPrimary={onPrimary} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'LOOKUP' }))
    expect(onPrimary).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<WorkflowWrapper {...defaultProps} onCancel={onCancel} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders a Dashboard link in the header', () => {
    render(<WorkflowWrapper {...defaultProps} />, { wrapper })
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument()
  })

  it('renders children in the main content area', () => {
    render(<WorkflowWrapper {...defaultProps} children={<div>unique-content</div>} />, { wrapper })
    expect(screen.getByText('unique-content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/WorkflowWrapper.test.tsx
```
Expected: Cannot find module `../../components/workflow/WorkflowWrapper`

- [ ] **Step 3: Create `frontend/src/components/workflow/WorkflowWrapper.tsx`**

```typescript
import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { theme } from '../../styles/theme'

type WorkflowStep = 'photograph' | 'lookup' | 'review'

const STEPS: WorkflowStep[] = ['photograph', 'lookup', 'review']
const STEP_LABELS: Record<WorkflowStep, string> = {
  photograph: 'Photograph',
  lookup: 'Lookup',
  review: 'Review',
}

export interface WorkflowWrapperProps {
  step: WorkflowStep
  controls: ReactNode
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  onCancel: () => void
  children: ReactNode
}

export default function WorkflowWrapper({
  step,
  controls,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  onCancel,
  children,
}: WorkflowWrapperProps) {
  return (
    <div
      style={{
        height: '100dvh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Zone 1: Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <strong>BookScan</strong>
        <Link to="/dashboard" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>
          Dashboard →
        </Link>
      </div>

      {/* Zone 2: Progress indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '0.4rem 1rem',
          flexShrink: 0,
        }}
      >
        {STEPS.map((s) => (
          <span
            key={s}
            style={{
              fontSize: '0.78rem',
              color: s === step ? '#fff' : '#555',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>{s === step ? '●' : '○'}</span>
            <span>{STEP_LABELS[s]}</span>
          </span>
        ))}
      </div>

      {/* Zone 3: Controls bar */}
      <div
        style={{
          padding: '0.4rem 1rem',
          minHeight: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {controls}
      </div>

      {/* Zone 4: Main content — grows to fill remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      {/* Zone 5: Primary button */}
      <div style={{ padding: '0.75rem 1rem 0.25rem', flexShrink: 0 }}>
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          style={{
            display: 'block',
            width: '100%',
            padding: '1rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: primaryDisabled ? '#222' : theme.colors.accent,
            color: primaryDisabled ? '#555' : '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: primaryDisabled ? 'default' : 'pointer',
          }}
        >
          {primaryLabel}
        </button>
      </div>

      {/* Zone 6: Cancel */}
      <div style={{ padding: '0.25rem 1rem 1rem', textAlign: 'center', flexShrink: 0 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '0.9rem',
            padding: '0.4rem 0.75rem',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/WorkflowWrapper.test.tsx
```
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/WorkflowWrapper.tsx frontend/src/__tests__/workflow/WorkflowWrapper.test.tsx
git commit -m "feat: add WorkflowWrapper component"
```

---

## Task 7: PhotographStep component + test

**Files:**
- Create: `frontend/src/components/workflow/PhotographStep.tsx`
- Create: `frontend/src/__tests__/workflow/PhotographStep.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/workflow/PhotographStep.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PhotographStep from '../../components/workflow/PhotographStep'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

const defaultProps = {
  photos: [] as File[],
  targetCount: 3,
  onTargetCountChange: vi.fn(),
  onPhotoAdded: vi.fn(),
  onCancel: vi.fn(),
}

describe('PhotographStep', () => {
  it('renders select with options 1–5', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(5)
    expect(options.map((o) => o.textContent)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('shows current capture count out of target', () => {
    const photos = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')]
    render(<PhotographStep {...defaultProps} photos={photos} targetCount={3} />, { wrapper })
    expect(screen.getByText('2 / 3 captured')).toBeInTheDocument()
  })

  it('calls onTargetCountChange when select value changes', () => {
    const onTargetCountChange = vi.fn()
    render(
      <PhotographStep {...defaultProps} onTargetCountChange={onTargetCountChange} />,
      { wrapper }
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } })
    expect(onTargetCountChange).toHaveBeenCalledWith(5)
  })

  it('calls onPhotoAdded when a file is selected via the hidden input', () => {
    const onPhotoAdded = vi.fn()
    render(
      <PhotographStep {...defaultProps} onPhotoAdded={onPhotoAdded} />,
      { wrapper }
    )
    const file = new File(['fake image'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(onPhotoAdded).toHaveBeenCalledWith(file)
  })

  it('renders thumbnails for each captured photo', () => {
    // jsdom can't decode blob URLs, but we verify the img count
    const photos = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')]
    render(<PhotographStep {...defaultProps} photos={photos} />, { wrapper })
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('primary button label is CAPTURE', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    expect(screen.getByRole('button', { name: 'CAPTURE' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/PhotographStep.test.tsx
```
Expected: Cannot find module

- [ ] **Step 3: Create `frontend/src/components/workflow/PhotographStep.tsx`**

```typescript
import { useRef, useEffect } from 'react'
import WorkflowWrapper from './WorkflowWrapper'

interface PhotographStepProps {
  photos: File[]
  targetCount: number
  onTargetCountChange: (n: number) => void
  onPhotoAdded: (file: File) => void
  onCancel: () => void
}

export default function PhotographStep({
  photos,
  targetCount,
  onTargetCountChange,
  onPhotoAdded,
  onCancel,
}: PhotographStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Create blob URLs for thumbnails; revoke on cleanup
  const thumbUrls = useRef<string[]>([])
  useEffect(() => {
    // Revoke all previous URLs before creating new ones
    thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    thumbUrls.current = photos.map((f) => URL.createObjectURL(f))
    return () => {
      thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [photos])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onPhotoAdded(file)
      // Reset so the same file can be re-selected next press
      e.target.value = ''
    }
  }

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        Photos:
        <select
          value={targetCount}
          onChange={(e) => onTargetCountChange(Number(e.target.value))}
          style={{
            background: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: 4,
            padding: '0.2rem 0.4rem',
            fontSize: '0.85rem',
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <span style={{ fontSize: '0.8rem', color: '#666' }}>{photos.length} / {targetCount} captured</span>
    </div>
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <WorkflowWrapper
        step="photograph"
        controls={controls}
        primaryLabel="CAPTURE"
        onPrimary={() => inputRef.current?.click()}
        onCancel={onCancel}
      >
        {/* Thumbnail grid */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.75rem',
            alignContent: 'flex-start',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {photos.map((_, i) => (
            <img
              key={i}
              src={thumbUrls.current[i] ?? ''}
              alt={`Photo ${i + 1}`}
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
            />
          ))}
          {photos.length === 0 && (
            <p style={{ color: '#444', fontSize: '0.9rem', margin: 'auto', textAlign: 'center', width: '100%' }}>
              Tap CAPTURE to photograph the book
            </p>
          )}
        </div>
      </WorkflowWrapper>
    </>
  )
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/PhotographStep.test.tsx
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/PhotographStep.tsx frontend/src/__tests__/workflow/PhotographStep.test.tsx
git commit -m "feat: add PhotographStep component"
```

---

## Task 8: LookupStep component + test

**Files:**
- Create: `frontend/src/components/workflow/LookupStep.tsx`
- Create: `frontend/src/__tests__/workflow/LookupStep.test.tsx`

> **CRITICAL:** The barcode capture code in this component is copied verbatim from the existing `Scanner.tsx`. Do not rewrite or simplify it. The high-resolution `getUserMedia` request, the 3-strategy crop loop, the `BrowserMultiFormatReader`, the torch state, and the cleanup logic must all be identical to what is in `Scanner.tsx` now. Simplifying this code will break reliable barcode detection.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/workflow/LookupStep.test.tsx`:

```typescript
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock getUserMedia before importing LookupStep
const mockTrack = {
  getCapabilities: () => ({ torch: false }),
  applyConstraints: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
}
const mockStream = {
  getVideoTracks: () => [mockTrack],
  getTracks: () => [mockTrack],
}
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
  configurable: true,
  writable: true,
})

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromCanvas: vi.fn().mockImplementation(() => { throw new Error('no barcode') }),
  })),
}))

vi.mock('../../api/books', () => ({
  lookupIsbn: vi.fn(),
}))

import LookupStep from '../../components/workflow/LookupStep'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('LookupStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders in camera mode by default — shows video element', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    expect(document.querySelector('video')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('switches to keyboard mode when keyboard icon button pressed', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })

  it('switches back to camera mode from keyboard mode', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    fireEvent.click(screen.getByLabelText('Switch to camera'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toBeInTheDocument()
  })

  it('shows camera-mode hint text by default', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    expect(screen.getByText('Align barcode and tap Lookup, or use keyboard')).toBeInTheDocument()
  })

  it('shows keyboard-mode hint text after switching', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    expect(screen.getByText('Type ISBN-10 or ISBN-13')).toBeInTheDocument()
  })

  it('in keyboard mode, calls lookupIsbn with entered value on LOOKUP press', async () => {
    const { lookupIsbn } = await import('../../api/books')
    const mockLookup = lookupIsbn as ReturnType<typeof vi.fn>
    mockLookup.mockResolvedValue({
      isbn: '9781234567890',
      title: 'Test',
      data_complete: true,
      author: null, publisher: null, edition: null, year: null,
      pages: null, dimensions: null, weight: null, subject: null,
      description: null, condition: null, cover_image_url: null, data_sources: null,
    })

    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '9781234567890' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'LOOKUP' }))
    })

    expect(mockLookup).toHaveBeenCalledWith('9781234567890')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/LookupStep.test.tsx
```
Expected: Cannot find module

- [ ] **Step 3: Create `frontend/src/components/workflow/LookupStep.tsx`**

**Copy the camera capture logic verbatim from the existing `Scanner.tsx`.** Then wrap it in the WorkflowWrapper with the new structure:

```typescript
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import WorkflowWrapper from './WorkflowWrapper'
import { lookupIsbn } from '../../api/books'
import { useScanAudio } from '../../hooks/useScanAudio'
import { BookLookup } from '../../types'
import { theme } from '../../styles/theme'

// --- Verbatim from Scanner.tsx — do not simplify ---
let persistedTorchOn = false

const CROP_STRATEGIES = [
  { srcW: 0.8,  srcH: 0.4,  zoom: 1 },
  { srcW: 0.95, srcH: 0.25, zoom: 1 },
  { srcW: 0.5,  srcH: 0.3,  zoom: 2 },
]
// ---------------------------------------------------

type LookupMode = 'camera' | 'keyboard'

interface LookupStepProps {
  onLookupComplete: (result: BookLookup) => void
  onCancel: () => void
}

export default function LookupStep({ onLookupComplete, onCancel }: LookupStepProps) {
  const [mode, setMode] = useState<LookupMode>('camera')
  const [isbn, setIsbn] = useState('')
  const [looking, setLooking] = useState(false)
  const [hintError, setHintError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(persistedTorchOn)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  const { playReview } = useScanAudio()

  // --- Verbatim camera setup from Scanner.tsx ---
  useEffect(() => {
    if (mode !== 'camera') return

    if (!navigator.mediaDevices) {
      setCameraError('Camera requires HTTPS.')
      return
    }

    readerRef.current = new BrowserMultiFormatReader()

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
        const hasTorch = !!caps.torch
        setTorchAvailable(hasTorch)
        if (persistedTorchOn && hasTorch) {
          track.applyConstraints({ advanced: [{ torch: true } as any] }).catch(() => {})
        } else if (persistedTorchOn && !hasTorch) {
          persistedTorchOn = false
          setTorchOn(false)
        }
      })
      .catch((e) => {
        setCameraError(`Camera error: ${e instanceof Error ? e.message : String(e)}`)
      })

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      trackRef.current = null
      setTorchAvailable(false)
      // torchOn state intentionally NOT reset — persistedTorchOn handles restoration on remount
    }
  }, [mode])
  // -----------------------------------------------

  async function handleTorchToggle() {
    if (!trackRef.current) return
    const next = !torchOn
    persistedTorchOn = next
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as any] })
      setTorchOn(next)
    } catch {
      persistedTorchOn = torchOn
    }
  }

  // --- Verbatim decode logic from Scanner.tsx ---
  async function handleCameraLookup() {
    if (looking || !videoRef.current || !canvasRef.current || !readerRef.current) return
    setLooking(true)
    setHintError(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      const vw = video.videoWidth
      const vh = video.videoHeight

      for (const { srcW, srcH, zoom } of CROP_STRATEGIES) {
        const sw = Math.round(vw * srcW)
        const sh = Math.round(vh * srcH)
        const sx = Math.round((vw - sw) / 2)
        const sy = Math.round((vh - sh) / 2)
        canvas.width = Math.round(sw * zoom)
        canvas.height = Math.round(sh * zoom)
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        try {
          const result = readerRef.current.decodeFromCanvas(canvas)
          await submitIsbn(result.getText())
          return
        } catch {
          // Try next strategy
        }
      }

      // All strategies failed
      playReview()
      setHintError('No barcode found — try again')
    } finally {
      setLooking(false)
    }
  }
  // -----------------------------------------------

  async function handleKeyboardLookup() {
    if (!isbn.trim() || looking) return
    setLooking(true)
    setHintError(null)
    try {
      await submitIsbn(isbn.trim())
    } finally {
      setLooking(false)
    }
  }

  async function submitIsbn(isbnValue: string) {
    try {
      const result = await lookupIsbn(isbnValue)
      onLookupComplete(result)
    } catch (e) {
      playReview()
      setHintError(e instanceof Error ? e.message : 'Lookup failed — try again')
    }
  }

  const cameraControls = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <button
        aria-label="Switch to keyboard input"
        onClick={() => { setMode('keyboard'); setHintError(null) }}
        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.3rem', padding: '0.25rem' }}
      >
        ⌨
      </button>
      {torchAvailable && (
        <button
          onClick={handleTorchToggle}
          style={{
            padding: '0.4rem 0.5rem',
            fontSize: '1.2rem',
            lineHeight: 1,
            background: torchOn ? '#FFD700' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
        >
          🔦
        </button>
      )}
    </div>
  )

  const keyboardControls = (
    <button
      aria-label="Switch to camera"
      onClick={() => { setMode('camera'); setHintError(null) }}
      style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.3rem', padding: '0.25rem' }}
    >
      📷
    </button>
  )

  const hintText = hintError
    ? hintError
    : mode === 'camera'
      ? 'Align barcode and tap Lookup, or use keyboard'
      : 'Type ISBN-10 or ISBN-13'

  const mainContent = mode === 'camera' ? (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <p style={{ color: 'red', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>{cameraError}</p>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            autoPlay
            muted
            playsInline
          />
          {/* Targeting mask — verbatim from Scanner.tsx */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: '10%',
                right: '10%',
                top: '25%',
                bottom: '25%',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: `3px solid ${theme.colors.accent}`, borderLeft: `3px solid ${theme.colors.accent}` }} />
              <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: `3px solid ${theme.colors.accent}`, borderRight: `3px solid ${theme.colors.accent}` }} />
              <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: `3px solid ${theme.colors.accent}`, borderLeft: `3px solid ${theme.colors.accent}` }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: `3px solid ${theme.colors.accent}`, borderRight: `3px solid ${theme.colors.accent}` }} />
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ padding: '0.75rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: hintError ? '#ff6b6b' : '#666', fontSize: '0.9rem', margin: 0 }}>
          {hintText}
        </p>
      </div>
    </div>
  ) : (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '1rem',
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        placeholder="Enter ISBN-10 or ISBN-13"
        value={isbn}
        onChange={(e) => setIsbn(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '0.75rem 1rem',
          fontSize: '1.1rem',
          background: '#111',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: 8,
          outline: 'none',
          textAlign: 'center',
          fontFamily: 'inherit',
        }}
      />
      <p style={{ color: hintError ? '#ff6b6b' : '#666', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
        {hintText}
      </p>
    </div>
  )

  return (
    <WorkflowWrapper
      step="lookup"
      controls={mode === 'camera' ? cameraControls : keyboardControls}
      primaryLabel={looking ? 'Looking up…' : 'LOOKUP'}
      onPrimary={mode === 'camera' ? handleCameraLookup : handleKeyboardLookup}
      onCancel={onCancel}
    >
      {mainContent}
    </WorkflowWrapper>
  )
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/LookupStep.test.tsx
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/LookupStep.tsx frontend/src/__tests__/workflow/LookupStep.test.tsx
git commit -m "feat: add LookupStep component with verbatim barcode capture logic"
```

---

## Task 9: ReviewStep component + test

**Files:**
- Create: `frontend/src/components/workflow/ReviewStep.tsx`
- Create: `frontend/src/__tests__/workflow/ReviewStep.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/workflow/ReviewStep.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReviewStep from '../../components/workflow/ReviewStep'
import { BookLookup } from '../../types'

const baseLookup: BookLookup = {
  isbn: '9781234567890',
  title: 'Test Book',
  author: 'Test Author',
  publisher: 'Test Publisher',
  edition: null,
  year: 2021,
  pages: null,
  dimensions: null,
  weight: null,
  subject: null,
  description: null,
  condition: null,
  cover_image_url: null,
  data_sources: null,
  data_complete: true,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('ReviewStep', () => {
  const defaultProps = {
    lookupResult: baseLookup,
    photos: [] as File[],
    savedBookId: null as string | null,
    onSavedBookId: vi.fn(),
    onSaveComplete: vi.fn(),
    onCancel: vi.fn(),
  }

  it('SAVE button is disabled before condition is selected', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    expect(screen.getByRole('button', { name: 'SAVE' })).toBeDisabled()
  })

  it('SAVE button is enabled after selecting a condition', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Good' }))
    expect(screen.getByRole('button', { name: 'SAVE' })).not.toBeDisabled()
  })

  it('all five condition options are rendered', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    ;['New', 'Very Good', 'Good', 'Acceptable', 'Poor'].forEach((c) => {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument()
    })
  })

  it('flag for review is unchecked when data_complete is true', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, data_complete: true }} />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /Flag for review/ })).not.toBeChecked()
  })

  it('flag for review is pre-checked when data_complete is false', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, data_complete: false }} />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /Flag for review/ })).toBeChecked()
  })

  it('user can override the flag for review checkbox', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, data_complete: false }} />, { wrapper })
    const checkbox = screen.getByRole('checkbox', { name: /Flag for review/ })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('displays title and author from lookup result', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    expect(screen.getByText('Test Book')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/ReviewStep.test.tsx
```
Expected: Cannot find module

- [ ] **Step 3: Create `frontend/src/components/workflow/ReviewStep.tsx`**

```typescript
import { useState } from 'react'
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

export default function ReviewStep({
  lookupResult,
  photos,
  savedBookId,
  onSavedBookId,
  onSaveComplete,
  onCancel,
}: ReviewStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [flagForReview, setFlagForReview] = useState(!lookupResult.data_complete)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { playSuccess } = useScanAudio()

  async function handleSave() {
    if (!condition || saving) return
    setSaving(true)
    setError('')

    try {
      let bookId = savedBookId

      // Step 1: Create book if not already created
      if (!bookId) {
        const book = await saveBook({
          ...lookupResult,
          condition,
          data_complete: flagForReview ? false : lookupResult.data_complete,
        })
        bookId = book.id
        onSavedBookId(bookId)
      }

      // Step 2: Compress and upload photos
      const blobs = await Promise.all(photos.map(compressPhoto))
      await uploadPhotos(bookId, blobs)

      playSuccess()
      onSaveComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — tap Save to retry photo upload')
    } finally {
      setSaving(false)
    }
  }

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
          padding: '1rem 1.25rem',
          color: '#fff',
        }}
      >
        {/* Cover + metadata */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
          {lookupResult.cover_image_url && (
            <img
              src={lookupResult.cover_image_url}
              alt="Cover"
              style={{ width: 60, borderRadius: 4, flexShrink: 0 }}
            />
          )}
          <div>
            <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', lineHeight: 1.3 }}>
              {lookupResult.title ?? 'Unknown Title'}
            </h2>
            <p style={{ margin: '0 0 0.1rem', fontSize: '0.95rem', color: '#ccc' }}>
              {lookupResult.author ?? '—'}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
              {[lookupResult.year, lookupResult.publisher].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Condition selector */}
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Condition
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              style={{
                flex: 1,
                minWidth: 60,
                padding: '0.5rem 0.25rem',
                fontSize: '0.78rem',
                background: condition === c ? '#fff' : '#111',
                color: condition === c ? '#000' : '#aaa',
                border: condition === c ? '1px solid #fff' : '1px solid #333',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: condition === c ? 600 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Flag for review */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            marginBottom: '0.75rem',
            fontSize: '0.9rem',
            color: '#aaa',
          }}
        >
          <input
            type="checkbox"
            checked={flagForReview}
            onChange={(e) => setFlagForReview(e.target.checked)}
          />
          Flag for review
        </label>

        {error && (
          <p style={{ color: theme.colors.danger, fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</p>
        )}
      </div>
    </WorkflowWrapper>
  )
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npm run test -- --run src/__tests__/workflow/ReviewStep.test.tsx
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/ReviewStep.tsx frontend/src/__tests__/workflow/ReviewStep.test.tsx
git commit -m "feat: add ReviewStep component with photo compression and save"
```

---

## Task 10: PhotoWorkflowPage + App routing + delete old files

**Files:**
- Create: `frontend/src/pages/PhotoWorkflowPage.tsx`
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/pages/ScanPage.tsx`
- Delete: `frontend/src/components/Scanner.tsx`
- Delete: `frontend/src/components/PhoneReview.tsx`

- [ ] **Step 1: Create `frontend/src/pages/PhotoWorkflowPage.tsx`**

```typescript
import { useState, useCallback } from 'react'
import PhotographStep from '../components/workflow/PhotographStep'
import LookupStep from '../components/workflow/LookupStep'
import ReviewStep from '../components/workflow/ReviewStep'
import { useScanAudio } from '../hooks/useScanAudio'
import { BookLookup } from '../types'

type WorkflowStep = 'photograph' | 'lookup' | 'review'

export default function PhotoWorkflowPage() {
  const [step, setStep] = useState<WorkflowStep>('photograph')
  const [photos, setPhotos] = useState<File[]>([])
  const [targetCount, setTargetCount] = useState<number>(
    () => Number(localStorage.getItem('photoTargetCount') ?? 3)
  )
  const [lookupResult, setLookupResult] = useState<BookLookup | null>(null)
  const [savedBookId, setSavedBookId] = useState<string | null>(null)

  const { playSuccess, playReview } = useScanAudio()

  function handlePhotoAdded(file: File) {
    setPhotos((prev) => {
      const next = [...prev, file]
      if (next.length >= targetCount) {
        setStep('lookup')
      }
      return next
    })
  }

  function handleTargetCountChange(n: number) {
    setTargetCount(n)
    localStorage.setItem('photoTargetCount', String(n))
  }

  const handleLookupComplete = useCallback(
    (result: BookLookup) => {
      setLookupResult(result)
      setSavedBookId(null)
      if (result.data_complete) playSuccess()
      else playReview()
      setStep('review')
    },
    [playSuccess, playReview]
  )

  function handleCancel() {
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setStep('photograph')
  }

  function handleSaveComplete() {
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setStep('photograph')
  }

  if (step === 'photograph') {
    return (
      <PhotographStep
        photos={photos}
        targetCount={targetCount}
        onTargetCountChange={handleTargetCountChange}
        onPhotoAdded={handlePhotoAdded}
        onCancel={handleCancel}
      />
    )
  }

  if (step === 'lookup') {
    return (
      <LookupStep
        onLookupComplete={handleLookupComplete}
        onCancel={handleCancel}
      />
    )
  }

  if (step === 'review' && lookupResult) {
    return (
      <ReviewStep
        lookupResult={lookupResult}
        photos={photos}
        savedBookId={savedBookId}
        onSavedBookId={setSavedBookId}
        onSaveComplete={handleSaveComplete}
        onCancel={handleCancel}
      />
    )
  }

  return null
}
```

- [ ] **Step 2: Update `frontend/src/App.tsx`**

Replace the import and route for `ScanPage` with `PhotoWorkflowPage`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import { useBreakpoint } from './hooks/useBreakpoint'
import LoginPage from './pages/LoginPage'
import PhotoWorkflowPage from './pages/PhotoWorkflowPage'
import DashboardPage from './pages/DashboardPage'

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth()
  const { isMobile } = useBreakpoint()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/scan" element={<PhotoWorkflowPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to={isMobile ? '/scan' : '/dashboard'} replace />} />
    </Routes>
  )
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Delete the old files**

```bash
git rm frontend/src/pages/ScanPage.tsx
git rm frontend/src/components/Scanner.tsx
git rm frontend/src/components/PhoneReview.tsx
```

- [ ] **Step 4: Run full frontend test suite**

```bash
cd frontend && npm run test -- --run
```
Expected: All tests pass. (TypeScript compiler will surface any remaining import errors from the deleted files.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PhotoWorkflowPage.tsx frontend/src/App.tsx
git commit -m "feat: add PhotoWorkflowPage and wire /scan route; remove old ScanPage, Scanner, PhoneReview"
```

---

## Task 11: Dashboard — has_photos indicator in BookTable + add Poor condition to BookForm

**Files:**
- Modify: `frontend/src/components/BookTable.tsx`
- Modify: `frontend/src/components/BookForm.tsx`

- [ ] **Step 1: Add has_photos indicator test to `BookTable.test.tsx`**

Add this test inside the existing `describe('BookTable', ...)` block:

```typescript
it('shows no-photos indicator when has_photos is false', () => {
  const books = [makeBook({ has_photos: false, title: 'No Photos Book' })]
  render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} onGenerateListing={vi.fn()} />)
  expect(screen.getByTitle('No photos')).toBeInTheDocument()
})

it('does not show no-photos indicator when has_photos is true', () => {
  const books = [makeBook({ has_photos: true, title: 'Has Photos Book' })]
  render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} onGenerateListing={vi.fn()} />)
  expect(screen.queryByTitle('No photos')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests — expect the two new tests to fail**

```bash
cd frontend && npm run test -- --run src/__tests__/BookTable.test.tsx
```
Expected: 2 new tests fail, existing tests pass.

- [ ] **Step 3: Open `frontend/src/components/BookTable.tsx` and add the indicator**

Find where the title cell is rendered. Add a small camera icon with `title="No photos"` when `!book.has_photos`. The exact location depends on the existing markup — find the title `<td>` and add inline:

```typescript
// In the title cell (wherever book.title is rendered):
{!book.has_photos && (
  <span
    title="No photos"
    style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: '#555', verticalAlign: 'middle' }}
  >
    📷
  </span>
)}
```

- [ ] **Step 4: Add 'Poor' to conditions in `frontend/src/components/BookForm.tsx`**

Find the line:
```typescript
const CONDITIONS = ['', 'New', 'Very Good', 'Good', 'Acceptable'] as const
```

Change to:
```typescript
const CONDITIONS = ['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd frontend && npm run test -- --run src/__tests__/BookTable.test.tsx
```
Expected: All tests pass including the 2 new ones.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/BookTable.tsx frontend/src/components/BookForm.tsx frontend/src/__tests__/BookTable.test.tsx
git commit -m "feat: add has_photos indicator to BookTable; add Poor condition to BookForm"
```

---

## Task 12: Dashboard — photo grid in book detail view

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add photo-related state and fetch to `DashboardPage.tsx`**

Add imports at the top:
```typescript
import { listPhotos, deletePhoto, getPhotoUrl } from '../api/photos'
import { BookPhoto } from '../types'
```

Add state inside `DashboardPage`:
```typescript
const [bookPhotos, setBookPhotos] = useState<BookPhoto[]>([])
const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
```

Add effect that runs when `editingBook` changes to load photos. Uses a cancellation flag to avoid stale closure over `photoUrls`:
```typescript
useEffect(() => {
  if (!editingBook) {
    setPhotoUrls({})
    setBookPhotos([])
    return
  }

  let cancelled = false
  const urlsCreated: string[] = []

  listPhotos(editingBook.id)
    .then(async (photos) => {
      if (cancelled) return
      setBookPhotos(photos)
      const urls: Record<string, string> = {}
      await Promise.all(
        photos.map(async (p) => {
          try {
            const url = await getPhotoUrl(p.id)
            if (cancelled) { URL.revokeObjectURL(url); return }
            urls[p.id] = url
            urlsCreated.push(url)
          } catch {
            // Photo file missing — skip
          }
        })
      )
      if (!cancelled) setPhotoUrls(urls)
    })
    .catch(() => {})

  return () => {
    cancelled = true
    urlsCreated.forEach((u) => URL.revokeObjectURL(u))
  }
}, [editingBook?.id])
```

- [ ] **Step 2: Add photo delete handler**

```typescript
async function handleDeletePhoto(photoId: string) {
  try {
    await deletePhoto(photoId)
    // Revoke blob URL
    if (photoUrls[photoId]) URL.revokeObjectURL(photoUrls[photoId])
    setPhotoUrls((prev) => { const next = { ...prev }; delete next[photoId]; return next })
    setBookPhotos((prev) => prev.filter((p) => p.id !== photoId))
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Delete failed')
  }
}
```

- [ ] **Step 3: Add photo grid above BookForm in the edit view branch**

In the `if (editingBook)` branch, add the photo grid above `<BookForm .../>`:

```typescript
{/* Photo grid */}
{bookPhotos.length > 0 && (
  <div style={{ marginBottom: '1.5rem' }}>
    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 500, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      Photos ({bookPhotos.length})
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {bookPhotos.map((photo) => (
        <div key={photo.id} style={{ position: 'relative' }}>
          <img
            src={photoUrls[photo.id] ?? ''}
            alt="Book photo"
            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4, display: 'block' }}
          />
          <button
            onClick={() => handleDeletePhoto(photo.id)}
            title="Delete photo"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 20,
              height: 20,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '0.65rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            aria-label="Delete photo"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Run full frontend test suite**

```bash
cd frontend && npm run test -- --run
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add photo grid with delete to book edit view"
```

---

## Task 13: Integration — docker build, migration, smoke test

**Files:** none new — verification only

- [ ] **Step 1: Build containers in dev mode**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```
Expected: All three containers start. Watch for build errors.

- [ ] **Step 2: Run database migration**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api alembic upgrade head
```
Expected output includes: `Running upgrade 002 -> 003` and ends with no error.

- [ ] **Step 3: Verify migration applied**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api alembic current
```
Expected: `003 (head)`

- [ ] **Step 4: Run backend tests inside container**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api python -m pytest tests/ -v
```
Expected: All tests pass.

- [ ] **Step 5: Smoke test the workflow on phone**

Open `https://<mac-ip>:3001` on phone browser.
- Login
- Verify `/scan` loads the Photograph step (progress indicator shows ●·Photograph)
- Select photo count, tap CAPTURE — native camera opens, take a photo
- After target count, workflow advances to Lookup step
- Align a book barcode and tap LOOKUP — verify decode works
- Verify Review step shows book metadata with condition selector
- Select condition, tap SAVE — verify success sound plays, returns to Photograph

- [ ] **Step 6: Smoke test dashboard photo display**

Open dashboard on desktop. Click edit on the saved book. Verify photo grid appears above the edit form with the correct photos.

- [ ] **Step 7: Commit (if any debug fixes were made during smoke test)**

If no fixes needed: proceed. If fixes were made, commit them with a descriptive message.

---

## Task 14: Update CLAUDE.md and push branch

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a CHANGES-04 completed section to `CLAUDE.md`**

Add to the `## Completed Iterations` section:

```markdown
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
```

Add to the `## Key Decisions & Gotchas` section:

```markdown
**Photo workflow (CHANGES-04).** Multi-step flow: Photograph → Lookup → Review. Photos held in browser memory as `File` objects until Save; uploaded via `POST /api/books/{id}/photos` after book creation. Photo files stored at `/app/photos/{book_id}/{photo_id}.jpg` in a named Docker volume.

**book_photos table.** Separate table (not JSON column on books) enables individual row deletes and per-book queries. `has_photos: bool` computed via EXISTS subquery in the router — not a model column. The photos Docker volume must be declared in both `docker-compose.yml` and `docker-compose.dev.yml`.

**LookupStep barcode capture.** Verbatim copy of the capture logic from the deleted `Scanner.tsx`: high-res `getUserMedia`, 3-strategy crop loop, module-level `persistedTorchOn`. Do not simplify — this combination was hard-won. See Scanner.tsx in git history if the logic needs review.

**Photo retry on save failure.** `PhotoWorkflowPage` stores `savedBookId` after successful `POST /api/books`. If the subsequent photo upload fails, `ReviewStep` retries only the upload (SAVE re-tapped) — it does not re-create the book.

**Blob URLs for photo display.** Dashboard photo grid fetches each photo via `GET /api/photos/{id}/file` (authenticated) and renders as blob URL. Blob URLs are revoked (`URL.revokeObjectURL`) when the edit view closes to prevent memory leaks.
```

- [ ] **Step 2: Run full test suite one final time**

```bash
cd api && .venv/bin/pytest tests/ -v
cd frontend && npm run test -- --run
```
Expected: All tests pass.

- [ ] **Step 3: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for CHANGES-04 photo workflow"
```

- [ ] **Step 4: Push branch to remote**

```bash
git push -u origin feat/photo-workflow
```
Expected: Branch pushed. To deploy and merge, see the Production Deployment section below.

---

## Production Deployment (after user testing on feature branch)

Run these commands on the Hetzner server after SSH:

```bash
git pull
git checkout feat/photo-workflow
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api alembic upgrade head
```

After confirming the feature works in production, merge to master:

```bash
git checkout master
git merge feat/photo-workflow
git push origin master
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

No additional migration needed after merge (migration 003 was already run).
