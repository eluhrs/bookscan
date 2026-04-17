"""ISBN profiler — lightweight barcode batch scanner with local SQLite storage."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.auth import get_current_user

router = APIRouter(prefix="/profiler", tags=["profiler"])

DB_PATH = Path("/app/isbn_scans.db")


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        "CREATE TABLE IF NOT EXISTS isbn_scans ("
        "isbn TEXT PRIMARY KEY, "
        "scanned_at TEXT NOT NULL DEFAULT (datetime('now'))"
        ")"
    )
    return conn


class ScanRequest(BaseModel):
    isbn: str


@router.post("/scans")
async def save_scan(
    body: ScanRequest,
    _user: str = Depends(get_current_user),
):
    conn = _get_db()
    try:
        conn.execute("INSERT INTO isbn_scans (isbn) VALUES (?)", (body.isbn,))
        conn.commit()
        return {"status": "saved"}
    except sqlite3.IntegrityError:
        return {"status": "duplicate"}
    finally:
        conn.close()


@router.get("/scans")
async def list_scans(_user: str = Depends(get_current_user)):
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT isbn, scanned_at FROM isbn_scans ORDER BY scanned_at DESC"
        ).fetchall()
        return [{"isbn": r[0], "scanned_at": r[1]} for r in rows]
    finally:
        conn.close()


@router.get("/scans/export")
async def export_scans(_user: str = Depends(get_current_user)):
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT isbn FROM isbn_scans ORDER BY scanned_at DESC"
        ).fetchall()
        text = "\n".join(r[0] for r in rows)
        return PlainTextResponse(text + "\n" if text else "")
    finally:
        conn.close()
