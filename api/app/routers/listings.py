import uuid
import io
import csv
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
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

    lines = [
        f"Title: {book.title or ''}",
        f"Author: {book.author or ''}",
        f"Publisher: {book.publisher or ''}",
        f"Edition: {book.edition or ''}",
        f"Year: {book.year or ''}",
        f"Pages: {book.pages or ''}",
        f"Dimensions: {book.dimensions or ''}",
        f"Weight: {book.weight or ''}",
        f"Subject: {book.subject or ''}",
    ]
    desc = f"\n{book.description}" if book.description else ""
    body = "\n".join(lines) + desc

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
    format: Optional[str] = Query(None),
):
    result = await db.scalars(
        select(Listing).order_by(Listing.created_at.desc())
    )
    listings = list(result.all())

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "book_id", "listing_text", "created_at", "ebay_status"])
        for l in listings:
            writer.writerow([l.id, l.book_id, l.listing_text, l.created_at, l.ebay_status])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=listings.csv"},
        )

    return [ListingResponse.model_validate(l) for l in listings]
