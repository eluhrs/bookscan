from __future__ import annotations

import logging
import httpx

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TIMEOUT_SECONDS = 8.0
MAX_OUTPUT_TOKENS = 150
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


class GeminiRateLimitError(Exception):
    """Raised when Gemini returns 429 — caller decides whether to retry."""


async def generate_summary_text(
    *,
    api_key: str,
    title: str | None,
    author: str | None,
    year: int | None,
    publisher: str | None,
) -> str | None:
    """Call Gemini once. Returns the text on success, None on any non-rate-limit failure.

    Raises GeminiRateLimitError on HTTP 429 so the caller can schedule a retry.
    """
    prompt = build_prompt(title, author, year, publisher)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": MAX_OUTPUT_TOKENS},
    }
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": api_key},
                json=payload,
            )
        if resp.status_code == 429:
            logger.warning("ai_summary: gemini 429 rate limit")
            raise GeminiRateLimitError()
        if resp.status_code != 200:
            logger.warning(
                "ai_summary: gemini http %s — %s",
                resp.status_code,
                resp.text[:200],
            )
            return None
        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            logger.warning("ai_summary: empty candidates")
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        return text or None
    except GeminiRateLimitError:
        raise
    except (httpx.HTTPError, httpx.TimeoutException) as e:
        logger.warning("ai_summary: httpx error %s", type(e).__name__)
        return None
    except Exception as e:  # defensive — never let a background task crash
        logger.exception("ai_summary: unexpected error %s", e)
        return None


def build_prompt(
    title: str | None,
    author: str | None,
    year: int | None,
    publisher: str | None,
) -> str:
    """Build the Gemini prompt for an eBay-style book blurb.

    Missing fields are omitted from the prompt rather than substituted with 'None'
    so the model isn't asked to write about an unknown publisher etc.
    """
    parts: list[str] = []
    if title:
        parts.append(f'"{title}"')
    if author:
        parts.append(f"by {author}")
    paren_bits: list[str] = []
    if year is not None:
        paren_bits.append(str(year))
    if publisher:
        paren_bits.append(publisher)
    if paren_bits:
        parts.append(f"({', '.join(paren_bits)})")
    subject = " ".join(parts) if parts else "this book"
    return (
        f"Write a 2-3 sentence summary suitable for an eBay book listing for {subject}. "
        "Focus on the book's subject matter, likely audience, and key themes. "
        "Do not fabricate specific facts not inferable from the metadata."
    )
