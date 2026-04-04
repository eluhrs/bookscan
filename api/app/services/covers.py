import httpx
from pathlib import Path

COVERS_DIR = Path("/app/covers")


async def download_cover(isbn: str, url: str) -> str | None:
    """Download cover image, return local path or None on failure."""
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    dest = COVERS_DIR / f"{isbn}.jpg"
    if dest.exists():
        return str(dest)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            return str(dest)
    except Exception:
        return None
