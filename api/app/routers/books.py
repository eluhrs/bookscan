import asyncio
import shutil
import uuid
from pathlib import Path
from typing import Annotated, Literal, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth import get_current_user
from app.database import get_db, async_session_maker
from app.models import Book, BookPhoto

PHOTOS_DIR = Path("/app/photos")
from app.schemas import (
    BookCreate,
    BookListResponse,
    BookLookupResponse,
    BookPhotoResponse,
    BookResponse,
    BookUpdate,
    SummaryRequest,
    SummaryResponse,
)
from app.config import settings
from app.services.ai_summary import (
    generate_and_store_summary,
    generate_summary_text,
    GeminiRateLimitError,
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
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    # Duplicate check: surface the existing record's UUID so the workflow can
    # route the user to the edit page instead of entering Review with a stale
    # lookup result that will 409 on save.
    existing = await db.scalar(select(Book.id).where(Book.isbn == isbn))
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
        description=book_data.description,
        cover_image_url=book_data.cover_image_url,
        data_sources=book_data.data_sources,
        needs_metadata_review=not complete,
        existing_book_id=existing,
    )


@router.post("/generate-summary", response_model=SummaryResponse)
@limiter.limit("20/minute")
async def generate_summary(
    request: Request,
    payload: SummaryRequest,
    _user: Annotated[str, Depends(get_current_user)],
):
    """Fire-and-return Gemini summary for in-flight workflow use.

    No DB writes. The caller (LookupStep → PhotoWorkflowPage) holds the
    response in memory and includes it in the eventual POST /books payload.
    Returns {description: null} on any failure (including missing API key
    or rate limit) so the caller can fall back to a blank description.
    """
    if not settings.gemini_api_key:
        return SummaryResponse(description=None)
    try:
        text = await generate_summary_text(
            api_key=settings.gemini_api_key,
            title=payload.title,
            author=payload.author,
            year=payload.year,
            publisher=payload.publisher,
        )
    except GeminiRateLimitError:
        return SummaryResponse(description=None)
    return SummaryResponse(description=text)


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(
    payload: BookCreate,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    existing = await db.scalar(select(Book).where(Book.isbn == payload.isbn))
    if existing:
        raise HTTPException(status_code=409, detail="Book with this ISBN already exists")
    data = payload.model_dump()
    # Derive description_source from data_sources when description came from a lookup.
    # If the caller explicitly passed description_source, respect that.
    if "description_source" not in payload.model_fields_set:
        ds = data.get("data_sources") or {}
        if data.get("description") and ds.get("description"):
            data["description_source"] = ds["description"]
    # Auto-compute needs_metadata_review on create unless the caller set it explicitly.
    if "needs_metadata_review" not in payload.model_fields_set:
        key_fields = ("title", "author", "publisher", "year")
        complete = bool(data.get("isbn")) and all(data.get(f) for f in key_fields)
        data["needs_metadata_review"] = not complete
    book = Book(**data)
    db.add(book)
    await db.commit()
    await db.refresh(book)
    # Schedule AI summary generation when no description came from lookup sources.
    if not book.description and settings.gemini_api_key:
        background_tasks.add_task(generate_and_store_summary, book.id)
    # Download cover in background (fire and forget)
    if book.cover_image_url:
        import asyncio
        asyncio.create_task(
            _store_cover(book.id, book.isbn, book.cover_image_url)
        )
    # Return BookResponse with no photos (new books have no photos)
    return BookResponse(
        id=book.id,
        isbn=book.isbn,
        title=book.title,
        author=book.author,
        publisher=book.publisher,
        edition=book.edition,
        year=book.year,
        pages=book.pages,
        dimensions=book.dimensions,
        weight=book.weight,
        description=book.description,
        cover_image_url=book.cover_image_url,
        cover_image_local=book.cover_image_local,
        data_sources=book.data_sources,
        needs_metadata_review=book.needs_metadata_review,
        condition=book.condition,
        needs_photo_review=book.needs_photo_review,
        description_source=book.description_source,
        needs_description_review=book.needs_description_review,
        description_generation_failed=book.description_generation_failed,
        price=book.price,
        ebay_category_id=book.ebay_category_id,
        ebay_category_name=book.ebay_category_name,
        archived=book.archived,
        has_photos=False,
        photos=[],
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


async def _store_cover(book_id: uuid.UUID, isbn: str, url: str) -> None:
    local_path = await download_cover(isbn, url)
    if local_path:
        async with async_session_maker() as db:
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
    status: Literal["all", "ready", "archived"] = Query("all"),
    review: Optional[Literal[
        "needs_metadata_review",
        "needs_photo_review",
        "needs_description_review",
        "needs_price",
    ]] = Query(None),
    search: Optional[str] = Query(None),
):
    q = select(Book)
    if status == "archived":
        q = q.where(Book.archived == True)  # noqa: E712
    elif status == "ready":
        q = q.where(Book.archived == False)  # noqa: E712
        q = q.where(Book.needs_metadata_review == False)  # noqa: E712
        q = q.where(Book.needs_photo_review == False)  # noqa: E712
        q = q.where(Book.needs_description_review == False)  # noqa: E712
        q = q.where(Book.price.isnot(None))
        q = q.where(Book.price > 0)
    if review == "needs_metadata_review":
        q = q.where(Book.needs_metadata_review == True)  # noqa: E712
    elif review == "needs_photo_review":
        q = q.where(Book.needs_photo_review == True)  # noqa: E712
    elif review == "needs_description_review":
        q = q.where(Book.needs_description_review == True)  # noqa: E712
    elif review == "needs_price":
        q = q.where((Book.price.is_(None)) | (Book.price <= 0))
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
        BookResponse(
            id=b.id,
            isbn=b.isbn,
            title=b.title,
            author=b.author,
            publisher=b.publisher,
            edition=b.edition,
            year=b.year,
            pages=b.pages,
            dimensions=b.dimensions,
            weight=b.weight,
            description=b.description,
            cover_image_url=b.cover_image_url,
            cover_image_local=b.cover_image_local,
            data_sources=b.data_sources,
            needs_metadata_review=b.needs_metadata_review,
            condition=b.condition,
            needs_photo_review=b.needs_photo_review,
            description_source=b.description_source,
            needs_description_review=b.needs_description_review,
            description_generation_failed=b.description_generation_failed,
            price=b.price,
            ebay_category_id=b.ebay_category_id,
            ebay_category_name=b.ebay_category_name,
            archived=b.archived,
            has_photos=b.id in photo_book_ids,
            photos=[],
            created_at=b.created_at,
            updated_at=b.updated_at,
        )
        for b in books
    ]
    return BookListResponse(items=items, total=total, page=page, page_size=page_size)


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
    photos = [BookPhotoResponse.model_validate(p) for p in book.photos]
    resp = BookResponse.model_validate(book)
    return resp.model_copy(update={
        "has_photos": len(book.photos) > 0,
        "photos": photos,
    })


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
    # needs_metadata_review is treated as a user-managed field on PATCH — only
    # updated when explicitly included in the payload. No auto-recompute.
    await db.commit()

    # Reload with photos for accurate has_photos
    stmt = select(Book).where(Book.id == book_id).options(selectinload(Book.photos))
    result = await db.execute(stmt)
    book = result.scalar_one()
    photos = [BookPhotoResponse.model_validate(p) for p in book.photos]
    resp = BookResponse.model_validate(book)
    return resp.model_copy(update={
        "has_photos": len(book.photos) > 0,
        "photos": photos,
    })


@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Delete photo files from disk before removing the DB record
    photos = (await db.scalars(select(BookPhoto).where(BookPhoto.book_id == book_id))).all()
    for photo in photos:
        await asyncio.to_thread((PHOTOS_DIR / photo.filename).unlink, missing_ok=True)
    await asyncio.to_thread(shutil.rmtree, str(PHOTOS_DIR / str(book_id)), ignore_errors=True)

    await db.delete(book)
    await db.commit()
