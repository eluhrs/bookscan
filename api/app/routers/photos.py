import asyncio
import io
import re
import uuid
import zipfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
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
    await asyncio.to_thread(book_dir.mkdir, parents=True, exist_ok=True)

    results = []
    for upload in files:
        photo_id = uuid.uuid4()
        filename = f"{book_id}/{photo_id}.jpg"
        file_path = PHOTOS_DIR / filename
        content = await upload.read()
        await asyncio.to_thread(file_path.write_bytes, content)

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
    file_exists = await asyncio.to_thread(file_path.exists)
    if file_exists:
        await asyncio.to_thread(file_path.unlink)

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
    file_exists = await asyncio.to_thread(file_path.exists)
    if not file_exists:
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(str(file_path), media_type="image/jpeg")


def _title_slug(title: str) -> str:
    """Convert title to a safe filename slug, max 50 chars."""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9]+', '_', slug)
    return slug.strip('_')[:50]


@router.get("/books/{book_id}/photos/download")
async def download_photos_zip(
    book_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[str, Depends(get_current_user)],
):
    """Stream a ZIP of all user-uploaded photos for a book, named photo_1.jpg etc."""
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    result = await db.scalars(
        select(BookPhoto)
        .where(BookPhoto.book_id == book_id)
        .order_by(BookPhoto.created_at)
    )
    photos = result.all()

    if not photos:
        raise HTTPException(status_code=404, detail="No photos to download")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, photo in enumerate(photos, 1):
            file_path = PHOTOS_DIR / photo.filename
            exists = await asyncio.to_thread(file_path.exists)
            if exists:
                content = await asyncio.to_thread(file_path.read_bytes)
                zf.writestr(f"photo_{i}.jpg", content)
    buf.seek(0)

    slug = _title_slug(book.title or "untitled")
    filename = f"{book.isbn}_{slug}.zip"

    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
