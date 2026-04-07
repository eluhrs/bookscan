import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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
    book_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for upload in files:
        photo_id = uuid.uuid4()
        filename = f"{book_id}/{photo_id}.jpg"
        file_path = PHOTOS_DIR / filename
        content = await upload.read()
        file_path.write_bytes(content)

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
    if file_path.exists():
        file_path.unlink()

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
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(str(file_path), media_type="image/jpeg")
