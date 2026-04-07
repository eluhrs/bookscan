import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    isbn: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    title: Mapped[str | None] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(Text)
    publisher: Mapped[str | None] = mapped_column(Text)
    edition: Mapped[str | None] = mapped_column(String(100))
    year: Mapped[int | None] = mapped_column(Integer)
    pages: Mapped[int | None] = mapped_column(Integer)
    dimensions: Mapped[str | None] = mapped_column(String(100))
    weight: Mapped[str | None] = mapped_column(String(100))
    subject: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(Text)
    cover_image_local: Mapped[str | None] = mapped_column(Text)
    data_sources: Mapped[dict | None] = mapped_column(JSON)
    data_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    condition: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    listings: Mapped[list["Listing"]] = relationship(back_populates="book", passive_deletes=True)
    photos: Mapped[list["BookPhoto"]] = relationship(back_populates="book", passive_deletes=True)


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE")
    )
    listing_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ebay_listing_id: Mapped[str | None] = mapped_column(String(100))
    ebay_status: Mapped[str] = mapped_column(String(20), default="draft")

    book: Mapped["Book"] = relationship(back_populates="listings")


class BookPhoto(Base):
    __tablename__ = "book_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE")
    )
    filename: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    book: Mapped["Book"] = relationship(back_populates="photos")
