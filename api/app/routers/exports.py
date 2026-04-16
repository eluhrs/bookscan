"""eBay CSV export with batch tracking and undo."""
import asyncio
import csv
import io
import logging
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Book, BookPhoto, ExportBatch

router = APIRouter(prefix="/exports", tags=["exports"])
logger = logging.getLogger(__name__)

CONDITION_MAP = {
    "Very Good": "4000",
    "Good": "5000",
    "Acceptable": "6000",
}

CSV_COLUMNS = [
    "Action",
    "Title",
    "Category",
    "ConditionID",
    "Description",
    "StartPrice",
    "Quantity",
    "Format",
    "Duration",
    "ShippingProfileName",
    "ReturnProfileName",
    "PictureName",
    "CustomLabel",
    "ISBN",
]

PHOTOS_DIR = Path("/app/photos")


def _collect_photos(
    book: Book,
    photos: list[BookPhoto],
) -> list[tuple[str, bytes]]:
    """Collect (zip_filename, data) pairs for a book's user photos only.

    Cover images are excluded from the export — they are low-resolution API
    thumbnails not suitable for eBay listings. Only user-taken photographs
    are included. Returns list of (filename, bytes) tuples. Skips missing
    files with a warning.
    """
    isbn = book.isbn
    entries: list[tuple[str, bytes]] = []

    for n, photo in enumerate(photos, 1):
        photo_path = PHOTOS_DIR / photo.filename
        if photo_path.exists():
            entries.append((f"photos/{isbn}_{n}.jpg", photo_path.read_bytes()))
        else:
            logger.warning("Photo file missing for ISBN %s: %s", isbn, photo_path)

    return entries


@router.post("")
async def export_books(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
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

    # Collect all photos (blocking IO in thread)
    all_photo_entries: list[tuple[str, bytes]] = []
    pic_names_by_book: dict[uuid.UUID, str] = {}
    for book in books:
        photos = photos_by_book.get(book.id, [])
        entries = await asyncio.to_thread(_collect_photos, book, photos)
        all_photo_entries.extend(entries)
        pic_names = ",".join(fname.removeprefix("photos/") for fname, _ in entries)
        pic_names_by_book[book.id] = pic_names

    # Generate CSV
    csv_output = io.StringIO()
    writer = csv.writer(csv_output)
    writer.writerow(CSV_COLUMNS)

    for book in books:
        writer.writerow([
            "Add",
            f"{book.title} by {book.author}",
            str(book.ebay_category_id or ""),
            CONDITION_MAP.get(book.condition, ""),
            book.description or "",
            f"{float(book.price):.2f}" if book.price else "",
            "1",
            "FixedPrice",
            "GTC",
            settings.ebay_shipping_profile,
            settings.ebay_return_policy,
            pic_names_by_book.get(book.id, ""),
            book.isbn,
            book.isbn,
        ])

    # Build ZIP
    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    csv_filename = f"bookscan-export-{timestamp}.csv"
    zip_filename = f"bookscan-export-{timestamp}.zip"

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(csv_filename, csv_output.getvalue())
        for photo_name, photo_data in all_photo_entries:
            zf.writestr(photo_name, photo_data)
    zip_buf.seek(0)

    # Archive all exported books
    for book in books:
        book.archived = True

    # Delete any previous export batch, create new one
    await db.execute(delete(ExportBatch))
    if book_ids:
        batch = ExportBatch(book_ids=[str(bid) for bid in book_ids])
        db.add(batch)

    await db.commit()

    return Response(
        content=zip_buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
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

    # Restore archived status on all books in the batch
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
