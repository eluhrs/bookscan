import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth import get_current_user
from app.database import get_db
from app.models import Book
from app.schemas import (
    BookCreate,
    BookListResponse,
    BookLookupResponse,
    BookResponse,
    BookUpdate,
)
from app.services.lookup import lookup_isbn
from app.services.covers import download_cover

router = APIRouter(prefix="/books", tags=["books"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/lookup/{isbn}", response_model=BookLookupResponse)
@limiter.limit("30/minute")
async def lookup_book(
    request: Request,
    isbn: str,
    _user: Annotated[str, Depends(get_current_user)],
):
    book_data, complete = await lookup_isbn(isbn)
    return BookLookupResponse(
        isbn=isbn,
        title=book_data.title,
        author=book_data.author,
        publisher=book_data.publisher,
        edition=book_data.edition,
        year=book_data.year,
        pages=book_data.pages,
        dimensions=book_data.dimensions,
        weight=book_data.weight,
        subject=book_data.subject,
        description=book_data.description,
        cover_image_url=book_data.cover_image_url,
        data_sources=book_data.data_sources,
        data_complete=complete,
    )


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(
    payload: BookCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    existing = await db.scalar(select(Book).where(Book.isbn == payload.isbn))
    if existing:
        raise HTTPException(status_code=409, detail="Book with this ISBN already exists")
    book = Book(**payload.model_dump())
    db.add(book)
    await db.commit()
    await db.refresh(book)
    # Download cover in background (fire and forget)
    if book.cover_image_url:
        import asyncio
        asyncio.create_task(
            _store_cover(db, book.id, book.isbn, book.cover_image_url)
        )
    return book


async def _store_cover(
    db: AsyncSession, book_id: uuid.UUID, isbn: str, url: str
) -> None:
    local_path = await download_cover(isbn, url)
    if local_path:
        book = await db.get(Book, book_id)
        if book:
            book.cover_image_local = local_path
            await db.commit()


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
    return BookListResponse(items=books, total=total, page=page, page_size=page_size)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: uuid.UUID,
    payload: BookUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    updated_fields = payload.model_dump(exclude_unset=True)
    for field, value in updated_fields.items():
        setattr(book, field, value)
    # Auto-recalculate data_complete if caller didn't explicitly set it
    if "data_complete" not in updated_fields:
        key_fields = ("title", "author", "publisher", "year")
        book.data_complete = bool(book.isbn) and all(getattr(book, f) for f in key_fields)
    await db.commit()
    await db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    await db.delete(book)
    await db.commit()
