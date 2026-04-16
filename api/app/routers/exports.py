"""eBay CSV export with batch tracking and undo."""
import csv
import io
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Book, BookPhoto, ExportBatch

router = APIRouter(prefix="/exports", tags=["exports"])

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


@router.post("")
async def export_csv(
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
                select(BookPhoto).where(BookPhoto.book_id.in_(book_ids))
            )
        ).all()
        for p in photo_rows:
            photos_by_book.setdefault(p.book_id, []).append(p)

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for book in books:
        photos = photos_by_book.get(book.id, [])
        pic_names = ",".join(f"{book.isbn}_{i+1}.jpg" for i in range(len(photos)))
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
            pic_names,
            book.isbn,
            book.isbn,
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

    # Return CSV as streaming response
    output.seek(0)
    filename = f"bookscan-export-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
