from __future__ import annotations

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TIMEOUT_SECONDS = 8.0
MAX_OUTPUT_TOKENS = 150
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


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
