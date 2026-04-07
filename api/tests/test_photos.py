import pytest
from pathlib import Path


@pytest.mark.asyncio
async def test_upload_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-001", "title": "Photo Test"}, headers=auth_headers
    )
    assert create.status_code == 201
    book_id = create.json()["id"]

    photo_bytes = b"fake jpeg content"
    resp = await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("test.jpg", photo_bytes, "image/jpeg"))],
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data) == 1
    assert data[0]["book_id"] == book_id

    photo_id = data[0]["id"]
    expected_file = tmp_path / book_id / f"{photo_id}.jpg"
    assert expected_file.exists()
    assert expected_file.read_bytes() == photo_bytes


@pytest.mark.asyncio
async def test_upload_photos_multiple(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-002", "title": "Multi Photo"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    resp = await client.post(
        f"/api/books/{book_id}/photos",
        files=[
            ("files", ("a.jpg", b"aaa", "image/jpeg")),
            ("files", ("b.jpg", b"bbb", "image/jpeg")),
            ("files", ("c.jpg", b"ccc", "image/jpeg")),
        ],
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_upload_photos_nonexistent_book(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    resp = await client.post(
        "/api/books/00000000-0000-0000-0000-000000000000/photos",
        files=[("files", ("x.jpg", b"x", "image/jpeg"))],
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-003", "title": "List Test"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("a.jpg", b"aaa", "image/jpeg"))],
        headers=auth_headers,
    )

    resp = await client.get(f"/api/books/{book_id}/photos", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["book_id"] == book_id


@pytest.mark.asyncio
async def test_delete_photo(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-004", "title": "Delete Test"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    upload = await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("x.jpg", b"xxx", "image/jpeg"))],
        headers=auth_headers,
    )
    photo_id = upload.json()[0]["id"]

    resp = await client.delete(f"/api/photos/{photo_id}", headers=auth_headers)
    assert resp.status_code == 204

    # File should be gone
    expected_file = tmp_path / book_id / f"{photo_id}.jpg"
    assert not expected_file.exists()

    # List should be empty
    list_resp = await client.get(f"/api/books/{book_id}/photos", headers=auth_headers)
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_delete_book_cascades_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-005", "title": "Cascade Test"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("z.jpg", b"zzz", "image/jpeg"))],
        headers=auth_headers,
    )

    del_resp = await client.delete(f"/api/books/{book_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Verify the book is gone (photo rows cascade via FK)
    gone = await client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert gone.status_code == 404


@pytest.mark.asyncio
async def test_get_book_includes_has_photos(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-006", "title": "Has Photos"}, headers=auth_headers
    )
    book_id = create.json()["id"]
    assert create.json()["has_photos"] is False

    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("p.jpg", b"ppp", "image/jpeg"))],
        headers=auth_headers,
    )

    resp = await client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert resp.json()["has_photos"] is True


@pytest.mark.asyncio
async def test_list_books_has_photos_field(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.photos.PHOTOS_DIR", tmp_path)

    create = await client.post(
        "/api/books", json={"isbn": "PHOTO-007", "title": "List Has Photos"}, headers=auth_headers
    )
    book_id = create.json()["id"]

    # Initially no photos
    resp = await client.get("/api/books", headers=auth_headers)
    item = next(i for i in resp.json()["items"] if i["id"] == book_id)
    assert item["has_photos"] is False

    # Upload one
    await client.post(
        f"/api/books/{book_id}/photos",
        files=[("files", ("q.jpg", b"qqq", "image/jpeg"))],
        headers=auth_headers,
    )

    resp = await client.get("/api/books", headers=auth_headers)
    item = next(i for i in resp.json()["items"] if i["id"] == book_id)
    assert item["has_photos"] is True
