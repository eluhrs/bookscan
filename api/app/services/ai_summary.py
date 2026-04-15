from __future__ import annotations

import asyncio
import logging
import uuid

import httpx

from app.config import settings
from app.database import async_session_maker
from app.models import Book

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash-lite"
# Per-attempt httpx timeout. With one retry (2 attempts total) this gives a
# worst-case wall time of ~7s, comfortably inside the frontend's 8s budget.
GEMINI_TIMEOUT_SECONDS = 3.5
MAX_ATTEMPTS = 2  # original call + one retry
# Generous: Gemini 2.5 Flash uses internal "thinking" tokens that count against
# this budget. We also set thinkingBudget=0 below to disable thinking entirely,
# so visible output gets the full allowance.
MAX_OUTPUT_TOKENS = 400
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
    """Call Gemini. Returns the text on success, None on any non-rate-limit failure.

    Two attempts total: the original call plus one retry on transient errors
    (5xx / network / timeout) after a brief backoff. Each attempt has its own
    3.5s httpx timeout. On HTTP 429 we raise GeminiRateLimitError so the caller
    can decide whether to schedule a longer-delay retry.
    """
    prompt = build_prompt(title, author, year, publisher)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            # Disable internal "thinking" tokens — for a 2-3 sentence blurb the
            # thinking tokens just eat the output budget and truncate the reply.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    last_status: int | None = None
    last_body: str = ""
    for attempt in range(MAX_ATTEMPTS):
        is_retry = attempt > 0
        try:
            async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
                resp = await client.post(
                    GEMINI_URL,
                    params={"key": api_key},
                    json=payload,
                )
            last_status = resp.status_code
            last_body = resp.text[:500]
            if resp.status_code == 429:
                # Rate limits aren't transient within seconds — surface to caller
                # so the background-task path can schedule a 60s retry instead of
                # hammering Gemini here.
                logger.warning(
                    "ai_summary: gemini %s 429 rate limit (attempt %d): %s",
                    GEMINI_MODEL,
                    attempt + 1,
                    last_body,
                )
                raise GeminiRateLimitError()
            if 500 <= resp.status_code < 600:
                if not is_retry:
                    logger.info(
                        "ai_summary: gemini %s %d (attempt %d) — retrying in 500ms: %s",
                        GEMINI_MODEL,
                        resp.status_code,
                        attempt + 1,
                        last_body,
                    )
                    await asyncio.sleep(0.5)
                    continue
                logger.warning(
                    "ai_summary: gemini %s %d (final attempt %d): %s",
                    GEMINI_MODEL,
                    resp.status_code,
                    attempt + 1,
                    last_body,
                )
                return None
            if resp.status_code != 200:
                logger.warning(
                    "ai_summary: gemini %s http %d (attempt %d) — %s",
                    GEMINI_MODEL,
                    resp.status_code,
                    attempt + 1,
                    last_body,
                )
                return None
            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                # Empty candidates commonly means safety block or prompt issue —
                # log the full response body so we can see promptFeedback /
                # finishReason. Safe to retry once in case of a transient blip.
                logger.warning(
                    "ai_summary: gemini %s empty candidates (attempt %d): %s",
                    GEMINI_MODEL,
                    attempt + 1,
                    last_body,
                )
                if not is_retry:
                    await asyncio.sleep(0.5)
                    continue
                return None
            parts = (candidates[0].get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts).strip()
            if text:
                return text
            # Empty text with candidates: same retry logic as empty candidates
            logger.warning(
                "ai_summary: gemini %s empty text (attempt %d) finishReason=%s",
                GEMINI_MODEL,
                attempt + 1,
                candidates[0].get("finishReason"),
            )
            if not is_retry:
                await asyncio.sleep(0.5)
                continue
            return None
        except GeminiRateLimitError:
            raise
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            if not is_retry:
                logger.info(
                    "ai_summary: httpx %s (attempt %d) — retrying in 500ms",
                    type(e).__name__,
                    attempt + 1,
                )
                await asyncio.sleep(0.5)
                continue
            logger.warning(
                "ai_summary: httpx %s (final attempt %d): %s",
                type(e).__name__,
                attempt + 1,
                e,
            )
            return None
        except Exception as e:  # defensive — never let a background task crash
            logger.exception("ai_summary: unexpected error %s", e)
            return None
    # Exhausted attempts without returning — log the last-known state.
    logger.warning(
        "ai_summary: gemini %s exhausted %d attempts, last_status=%s body=%s",
        GEMINI_MODEL,
        MAX_ATTEMPTS,
        last_status,
        last_body,
    )
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
        f"Write a factual, scholarly description of {subject} for an online "
        "bookseller's listing. Length: 3 to 5 sentences. Tone: sedate, "
        "understated — write as a librarian or academic bookseller would, "
        "not as a marketing copywriter. State what the book is about, its "
        "intellectual or academic context where inferable from the metadata, "
        "and its likely audience. Do not fabricate specific facts not "
        "directly inferable from the title, author, publisher, or year. "
        "Do not use superlatives or value judgments. Do not use promotional "
        "phrases such as 'captivating', 'perfect for', 'delve into', "
        "'journey', or 'exploration'."
    )


async def generate_and_store_summary(
    book_id: uuid.UUID,
    *,
    retry_on_rate_limit: bool = True,
) -> None:
    """Background task: fetch a Gemini summary and persist it.

    Opens its own session — the request session is closed by the time this runs.
    Silent on failure — sets description_generation_failed=True and logs.
    """
    api_key = settings.gemini_api_key
    if not api_key:
        logger.info("ai_summary: skipped, no GEMINI_API_KEY")
        return

    async with async_session_maker() as db:
        book = await db.get(Book, book_id)
        if book is None:
            logger.warning("ai_summary: book %s not found", book_id)
            return
        if book.description:
            logger.info("ai_summary: book %s already has description, skipping", book_id)
            return

        try:
            text = await generate_summary_text(
                api_key=api_key,
                title=book.title,
                author=book.author,
                year=book.year,
                publisher=book.publisher,
            )
        except GeminiRateLimitError:
            if retry_on_rate_limit:
                logger.info("ai_summary: 429 — scheduling 60s retry for %s", book_id)
                asyncio.create_task(_retry_after_delay(book_id, delay_seconds=60))
                return
            text = None

        if text:
            book.description = text
            book.description_source = "ai_generated"
            book.needs_description_review = True
            book.description_generation_failed = False
        else:
            book.description_generation_failed = True
        await db.commit()


async def _retry_after_delay(book_id: uuid.UUID, *, delay_seconds: int) -> None:
    await asyncio.sleep(delay_seconds)
    await generate_and_store_summary(book_id, retry_on_rate_limit=False)
