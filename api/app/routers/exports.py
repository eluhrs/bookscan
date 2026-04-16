"""eBay CSV export with batch tracking and undo."""
import csv
import io
import logging
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Book, BookPhoto, ExportBatch
from app.services.photo_urls import generate_signed_photo_url

router = APIRouter(prefix="/exports", tags=["exports"])
logger = logging.getLogger(__name__)

CONDITION_MAP = {
    "Very Good": "4000",
    "Good": "5000",
    "Acceptable": "6000",
}

EBAY_CATEGORY_NAMES = {
    261186: "Books",
    29223: "Antiquarian & Collectible",
    1105: "Textbooks",
    69496: "Maps & Atlases",
}

CSV_COLUMNS = [
    "*Action(SiteID=US|Country=US|Currency=USD|Version=1193)",
    "Custom label (SKU)",
    "Category ID",
    "Category name",
    "Title",
    "P:ISBN",
    "Start price",
    "Quantity",
    "Item photo URL",
    "Condition ID",
    "Description",
    "Format",
    "Duration",
    "Shipping profile name",
    "Return profile name",
    "Payment profile name",
    "C:Book Title",
    "C:Author",
    "C:Language",
]


def _build_base_url(request: Request) -> str:
    """Derive the public base URL from the incoming request."""
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    return f"{scheme}://{host}"


@router.post("")
async def export_books(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    base_url = _build_base_url(request)

    # Fetch all "ready to list" books
    q = select(Book)
    q = q.where(Book.archived == False)  # noqa: E712
    q = q.where(Book.needs_metadata_review == False)  # noqa: E712
    q = q.where(Book.needs_photo_review == False)  # noqa: E712
    q = q.where(Book.needs_description_review == False)  # noqa: E712
    q = q.where(Book.price.isnot(None))
    q = q.where(Book.price > 0)
    books = (await db.scalars(q)).all()

    # Fetch photos for all books in one query
    book_ids = [b.id for b in books]
    photos_by_book: dict[uuid.UUID, list[BookPhoto]] = {}
    if book_ids:
        photo_rows = (
            await db.scalars(
                select(BookPhoto)
                .where(BookPhoto.book_id.in_(book_ids))
                .order_by(BookPhoto.created_at)
            )
        ).all()
        for p in photo_rows:
            photos_by_book.setdefault(p.book_id, []).append(p)

    # Generate CSV
    csv_output = io.StringIO()
    writer = csv.writer(csv_output)
    writer.writerow(CSV_COLUMNS)

    secret = settings.photo_signing_secret

    for book in books:
        # Build pipe-separated signed photo URLs
        photos = photos_by_book.get(book.id, [])
        photo_urls = ""
        if photos and secret:
            urls = []
            for n in range(1, len(photos) + 1):
                urls.append(generate_signed_photo_url(book.isbn, n, base_url, secret))
            photo_urls = "|".join(urls)

        category_name = EBAY_CATEGORY_NAMES.get(book.ebay_category_id or 0, "")

        writer.writerow([
            "Add",
            book.isbn,
            str(book.ebay_category_id or ""),
            category_name,
            f"{book.title} by {book.author}",
            book.isbn,
            f"{float(book.price):.2f}" if book.price else "",
            "1",
            photo_urls,
            CONDITION_MAP.get(book.condition, ""),
            book.description or "",
            "FixedPrice",
            "GTC",
            settings.ebay_shipping_profile,
            settings.ebay_return_policy,
            settings.ebay_payment_profile or "",
            book.title or "",
            book.author or "",
            "English",
        ])

    # Archive all exported books
    for book in books:
        book.archived = True

    # Delete any previous export batch, create new one
    await db.execute(delete(ExportBatch))
    if book_ids:
        batch = ExportBatch(book_ids=[str(bid) for bid in book_ids])
        db.add(batch)

    await db.commit()

    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    csv_filename = f"bookscan-export-{timestamp}.csv"

    return Response(
        content=csv_output.getvalue().encode("utf-8"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{csv_filename}"'},
    )


@router.get("/batch")
async def get_batch(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    batch = await db.scalar(
        select(ExportBatch).order_by(ExportBatch.id.desc()).limit(1)
    )
    if not batch:
        return None
    return {
        "id": batch.id,
        "exported_at": batch.exported_at.isoformat() if batch.exported_at else None,
        "book_ids": batch.book_ids,
        "count": len(batch.book_ids),
    }


@router.post("/batch/undo")
async def undo_batch(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    batch = await db.scalar(
        select(ExportBatch).order_by(ExportBatch.id.desc()).limit(1)
    )
    if not batch:
        return {"detail": "No batch to undo", "count": 0}

    count = 0
    for bid_str in batch.book_ids:
        book = await db.get(Book, uuid.UUID(bid_str))
        if book:
            book.archived = False
            count += 1

    await db.delete(batch)
    await db.commit()

    return {"detail": "Batch undone", "count": count}


@router.delete("/batch", status_code=204)
async def dismiss_batch(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    await db.execute(delete(ExportBatch))
    await db.commit()
