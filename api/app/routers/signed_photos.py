"""Public endpoint for serving photos via signed URLs."""
import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker
from app.models import Book, BookPhoto
from app.services.photo_urls import verify_signed_url

router = APIRouter(tags=["signed-photos"])

PHOTOS_DIR = Path("/app/photos")

# Match {isbn}_{n}.jpg
FILENAME_RE = re.compile(r"^(\d{10,13})_(\d+)\.jpg$")


@router.get("/photos/{filename}")
async def get_signed_photo(
    filename: str,
    expires: Annotated[int, Query()],
    token: Annotated[str, Query()],
):
    """Serve a photo file if the signed URL is valid and not expired."""
    secret = settings.photo_signing_secret
    if not secret:
        raise HTTPException(status_code=404)

    if not verify_signed_url(filename, expires, token, secret):
        raise HTTPException(status_code=404)

    m = FILENAME_RE.match(filename)
    if not m:
        raise HTTPException(status_code=404)

    isbn = m.group(1)
    n = int(m.group(2))

    # Look up the book and its nth photo
    async with async_session_maker() as session:
        book = await session.scalar(select(Book).where(Book.isbn == isbn))
        if not book:
            raise HTTPException(status_code=404)

        photos = (
            await session.scalars(
                select(BookPhoto)
                .where(BookPhoto.book_id == book.id)
                .order_by(BookPhoto.created_at)
            )
        ).all()

    if n < 1 or n > len(photos):
        raise HTTPException(status_code=404)

    photo = photos[n - 1]
    file_path = PHOTOS_DIR / photo.filename
    if not file_path.exists():
        raise HTTPException(status_code=404)

    return FileResponse(str(file_path), media_type="image/jpeg")
