import uuid
import io
import csv
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user
from app.database import get_db
from app.models import Book, Listing
from app.schemas import ListingResponse

router = APIRouter(tags=["listings"])


def generate_listing_text(book: Book) -> str:
    edition_str = f" {book.edition}" if book.edition else ""
    title_line = f"{book.title or 'Unknown'} by {book.author or 'Unknown'} ({book.year or 'n.d.'}){edition_str} - {book.publisher or 'Unknown'}"
    condition = book.condition or "Used"

    field_map = [
        ("Title", book.title),
        ("Author", book.author),
        ("Publisher", book.publisher),
        ("Edition", book.edition),
        ("Year", book.year),
        ("Pages", book.pages),
        ("Dimensions", book.dimensions),
        ("Weight", book.weight),
        ("Subject", book.subject),
    ]
    lines = [f"{label}: {value}" for label, value in field_map if value]
    if book.description:
        lines.append(f"\nDescription: {book.description}")
    body = "\n".join(lines)

    return f"LISTING TITLE: {title_line}\n\nCONDITION: {condition}\n\nDESCRIPTION:\n{body}"


@router.post("/books/{book_id}/listings", response_model=ListingResponse, status_code=201)
async def create_listing(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    text = generate_listing_text(book)
    listing = Listing(book_id=book_id, listing_text=text, ebay_status="draft")
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return listing


@router.get("/books/{book_id}/listings", response_model=list[ListingResponse])
async def get_book_listings(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    result = await db.scalars(
        select(Listing).where(Listing.book_id == book_id).order_by(Listing.created_at.desc())
    )
    return list(result.all())


@router.get("/listings")
async def get_all_listings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
    export_format: Optional[str] = Query(None, alias="format"),
) -> Response:
    if export_format == "csv":
        # Export all books; include most recent listing text per book if it exists
        books_result = await db.scalars(
            select(Book)
            .options(selectinload(Book.listings))
            .order_by(Book.created_at.desc())
        )
        books = list(books_result.all())

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "title", "author", "publisher", "edition", "year", "pages",
            "dimensions", "weight", "subject", "description", "condition",
            "isbn", "listing_text", "created_at", "ebay_status",
        ])
        for b in books:
            latest = max(b.listings, key=lambda l: l.created_at, default=None)
            writer.writerow([
                b.title, b.author, b.publisher, b.edition, b.year, b.pages,
                b.dimensions, b.weight, b.subject, b.description, b.condition,
                b.isbn,
                latest.listing_text if latest else "",
                latest.created_at if latest else "",
                latest.ebay_status if latest else "",
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=listings.csv"},
        )

    # JSON: return listing objects as before
    result = await db.scalars(
        select(Listing)
        .options(selectinload(Listing.book))
        .order_by(Listing.created_at.desc())
    )
    listings = list(result.all())
    return JSONResponse([ListingResponse.model_validate(l).model_dump(mode='json') for l in listings])
