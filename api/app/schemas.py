import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# Auth
class Token(BaseModel):
    access_token: str
    token_type: str


# Book
class BookLookupResponse(BaseModel):
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    pages: Optional[int] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    data_sources: Optional[dict] = None
    data_complete: bool = False


class BookCreate(BaseModel):
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    pages: Optional[int] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    data_sources: Optional[dict] = None
    data_complete: bool = False
    condition: Optional[str] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    pages: Optional[int] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    data_complete: Optional[bool] = None
    condition: Optional[str] = None


class BookPhotoResponse(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    filename: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BookResponse(BaseModel):
    id: uuid.UUID
    isbn: str
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    pages: Optional[int] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    cover_image_local: Optional[str] = None
    data_sources: Optional[dict] = None
    data_complete: bool
    condition: Optional[str] = None
    has_photos: bool = False
    photos: list[BookPhotoResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookListResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    page_size: int


# Listing
class ListingResponse(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    listing_text: str
    created_at: datetime
    ebay_listing_id: Optional[str] = None
    ebay_status: str

    model_config = {"from_attributes": True}
