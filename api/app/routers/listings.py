import uuid
import io
import csv
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user
from app.database import get_db
from app.models import Book, Listing
from app.schemas import ListingResponse

router = APIRouter(tags=["listings"])


def generate_listing_text(book: Book) -> str:
    edition_str = f" {book.edition}" if book.edition else ""
    title_line = f"{book.title or 'Unknown'} by {book.author or 'Unknown'} ({book.year or 'n.d.'}){edition_str} - {book.publisher or 'Unknown'}"

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

    return f"TITLE: {title_line}\n\nCONDITION: Used\n\nDESCRIPTION:\n{body}"


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
    result = await db.scalars(
        select(Listing).order_by(Listing.created_at.desc())
    )
    listings = list(result.all())

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "book_id", "listing_text", "created_at", "ebay_status"])
        for listing in listings:
            writer.writerow([listing.id, listing.book_id, listing.listing_text, listing.created_at, listing.ebay_status])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=listings.csv"},
        )

    return JSONResponse([ListingResponse.model_validate(listing).model_dump(mode='json') for listing in listings])
