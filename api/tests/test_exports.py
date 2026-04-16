"""Tests for the eBay CSV export endpoints."""
import csv
import io
import zipfile
import pytest
import pytest_asyncio
from pathlib import Path
from unittest.mock import patch
from httpx import AsyncClient
from tests._helpers import TestSession
from app.models import Book


def _ready_book(isbn, title="Test Book", author="Author"):
    """Payload for a book that passes the 'ready' filter."""
    return {
        "isbn": isbn,
        "title": title,
        "author": author,
        "publisher": "Pub",
        "year": 2020,
        "needs_metadata_review": False,
        "needs_photo_review": False,
        "needs_description_review": False,
        "price": 9.99,
        "condition": "Good",
        "ebay_category_id": 279,
    }


@pytest.mark.asyncio
async def test_export_csv_downloads(client: AsyncClient, auth_headers: dict):
    # Create a ready book
    await client.post("/api/books", json=_ready_book("9780000000001"), headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200
    assert "application/zip" in resp.headers["content-type"]
    assert "bookscan-export-" in resp.headers["content-disposition"]

    buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(buf) as zf:
        csv_files = [n for n in zf.namelist() if n.endswith(".csv")]
        assert len(csv_files) == 1
        csv_content = zf.read(csv_files[0]).decode("utf-8")

    reader = csv.reader(io.StringIO(csv_content))
    rows = list(reader)
    assert len(rows) == 2  # header + 1 data row
    header = rows[0]
    assert "Action" in header
    assert "Title" in header
    assert "ISBN" in header
    assert "StartPrice" in header
    assert "ConditionID" in header
    assert "PictureName" in header

    data = dict(zip(header, rows[1]))
    assert data["Action"] == "Add"
    assert data["Title"] == "Test Book by Author"
    assert data["ISBN"] == "9780000000001"
    assert data["StartPrice"] == "9.99"
    assert data["Quantity"] == "1"
    assert data["Format"] == "FixedPrice"
    assert data["Duration"] == "GTC"
    assert data["Category"] == "279"
    assert data["ConditionID"] == "5000"  # Good


@pytest.mark.asyncio
async def test_export_condition_mapping(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/books", json=_ready_book("9780000000002"), headers=auth_headers)
    book_id = resp.json()["id"]
    await client.patch(f"/api/books/{book_id}", json={"condition": "Very Good"}, headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(buf) as zf:
        csv_files = [n for n in zf.namelist() if n.endswith(".csv")]
        csv_content = zf.read(csv_files[0]).decode("utf-8")
    reader = csv.reader(io.StringIO(csv_content))
    rows = list(reader)
    header = rows[0]
    data = dict(zip(header, rows[1]))
    assert data["ConditionID"] == "4000"


@pytest.mark.asyncio
async def test_export_archives_records(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000003"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Book should now be archived
    resp = await client.get("/api/books", params={"status": "archived"}, headers=auth_headers)
    assert resp.json()["total"] == 1

    # And not in the ready filter
    resp = await client.get("/api/books", params={"status": "ready"}, headers=auth_headers)
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_export_creates_batch(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/books", json=_ready_book("9780000000004"), headers=auth_headers)
    book_id = resp.json()["id"]

    await client.post("/api/exports", headers=auth_headers)

    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert body["count"] == 1
    assert book_id in body["book_ids"]


@pytest.mark.asyncio
async def test_export_no_ready_books_returns_empty(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200

    buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(buf) as zf:
        csv_files = [n for n in zf.namelist() if n.endswith(".csv")]
        csv_content = zf.read(csv_files[0]).decode("utf-8")
    reader = csv.reader(io.StringIO(csv_content))
    rows = list(reader)
    assert len(rows) == 1  # header only


@pytest.mark.asyncio
async def test_undo_restores_books(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000005"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Undo
    resp = await client.post("/api/exports/batch/undo", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 1

    # Book should be back in ready
    resp = await client.get("/api/books", params={"status": "ready"}, headers=auth_headers)
    assert resp.json()["total"] == 1

    # Batch should be gone
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.json() is None


@pytest.mark.asyncio
async def test_dismiss_batch(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000006"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Dismiss
    resp = await client.delete("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 204

    # Batch is gone
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.json() is None

    # But book is still archived
    resp = await client.get("/api/books", params={"status": "archived"}, headers=auth_headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_no_batch_returns_null(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.asyncio
async def test_new_export_replaces_old_batch(client: AsyncClient, auth_headers: dict):
    # First book + export
    await client.post("/api/books", json=_ready_book("9780000000007", title="Book One"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Second book + export
    resp = await client.post("/api/books", json=_ready_book("9780000000008", title="Book Two"), headers=auth_headers)
    book2_id = resp.json()["id"]
    await client.post("/api/exports", headers=auth_headers)

    # Batch should only contain the second book
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    body = resp.json()
    assert body["count"] == 1
    assert book2_id in body["book_ids"]


@pytest.mark.asyncio
async def test_export_requires_auth(client: AsyncClient):
    resp = await client.post("/api/exports")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_returns_zip_with_csv(client: AsyncClient, auth_headers: dict):
    """Export should return a ZIP containing a CSV file."""
    await client.post("/api/books", json=_ready_book("9780000000101"), headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200
    assert "application/zip" in resp.headers["content-type"]
    assert "bookscan-export-" in resp.headers["content-disposition"]
    assert resp.headers["content-disposition"].endswith('.zip"')

    buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(buf) as zf:
        names = zf.namelist()
        csv_files = [n for n in names if n.endswith(".csv")]
        assert len(csv_files) == 1
        assert csv_files[0].startswith("bookscan-export-")

        csv_content = zf.read(csv_files[0]).decode("utf-8")
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)
        assert len(rows) == 2
        header = rows[0]
        data = dict(zip(header, rows[1]))
        assert data["Action"] == "Add"
        assert data["ISBN"] == "9780000000101"


@pytest.mark.asyncio
async def test_export_zip_includes_user_photos_only(client: AsyncClient, auth_headers: dict):
    """ZIP should include only user photos (not covers), named {isbn}_{n}.jpg."""
    book_data = _ready_book("9780000000102")
    book_data["cover_image_url"] = "https://example.com/cover.jpg"
    resp = await client.post("/api/books", json=book_data, headers=auth_headers)
    book_id = resp.json()["id"]

    # Set cover_image_local — should NOT appear in ZIP
    cover_path = Path("/tmp/bookscan_test_covers/9780000000102.jpg")
    cover_path.parent.mkdir(parents=True, exist_ok=True)
    cover_path.write_bytes(b"FAKE_COVER_DATA")

    import uuid as _uuid
    async with TestSession() as session:
        book = await session.get(Book, _uuid.UUID(book_id))
        book.cover_image_local = str(cover_path)
        await session.commit()

    # Upload a user photo via API
    with patch("app.routers.photos.PHOTOS_DIR", Path("/tmp/bookscan_test_photos")):
        resp = await client.post(
            f"/api/books/{book_id}/photos",
            files=[("files", ("photo.jpg", b"FAKE_PHOTO_DATA", "image/jpeg"))],
            headers=auth_headers,
        )
    assert resp.status_code == 201
    photo_id = resp.json()[0]["id"]

    # Write the user photo file where PHOTOS_DIR expects it
    user_photo_path = Path(f"/tmp/bookscan_test_photos/{book_id}/{photo_id}.jpg")
    user_photo_path.parent.mkdir(parents=True, exist_ok=True)
    user_photo_path.write_bytes(b"FAKE_PHOTO_DATA")

    with patch("app.routers.exports.PHOTOS_DIR", Path("/tmp/bookscan_test_photos")):
        resp = await client.post("/api/exports", headers=auth_headers)

    assert resp.status_code == 200
    buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(buf) as zf:
        names = zf.namelist()
        photo_files = [n for n in names if n.startswith("photos/")]
        # Only user photo, no cover
        assert photo_files == ["photos/9780000000102_1.jpg"]
        assert zf.read("photos/9780000000102_1.jpg") == b"FAKE_PHOTO_DATA"

        # PictureName in CSV should match (user photo only)
        csv_files = [n for n in names if n.endswith(".csv")]
        csv_content = zf.read(csv_files[0]).decode("utf-8")
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)
        header = rows[0]
        data = dict(zip(header, rows[1]))
        assert data["PictureName"] == "9780000000102_1.jpg"

    # Cleanup
    import shutil
    shutil.rmtree("/tmp/bookscan_test_covers", ignore_errors=True)
    shutil.rmtree("/tmp/bookscan_test_photos", ignore_errors=True)
