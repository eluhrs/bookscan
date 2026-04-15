# CHANGES-17 — AI-Generated Book Summaries (Design)

Date: 2026-04-14
Spec source: `CHANGES-17.md`

## Summary

When a book record is created and no description was returned by Open Library, Google Books, or Library of Congress, fire a background task that asks Gemini 2.5 Flash for a 2–3 sentence summary suitable for an eBay listing. The summary populates `description`, sets `description_source = 'ai_generated'`, and flips a new `needs_description_review` toggle ON for user review. Failures are silent for this iteration — the field stays empty and the user can fill it in manually.

## Resolved decisions

| Decision | Choice | Reason |
|---|---|---|
| HTTP client | raw `httpx` (no SDK) | matches `lookup.py`, no new dependency |
| Model | `gemini-2.5-flash` | 10 RPM / 500 RPD free tier, replaces deprecated 2.0 Flash |
| Worktree | `.worktrees/changes-17/` | per user workflow |
| Retry UI | **deferred to a future iteration** | failure is silent; description left empty |
| `regenerate-summary` endpoint | **deferred** | nothing calls it without retry UI |
| Historical backfill of `description_source` | none | existing data is test data; leave NULL |

## Architecture

```
POST /books  ──► returns 201 immediately
     │
     └─► BackgroundTasks.add_task(generate_and_store_summary, book_id)
              │
              ├─ open new async_session_maker() (request session is closed)
              ├─ re-fetch book; bail if description already non-empty
              ├─ httpx POST gemini-2.5-flash:generateContent
              │       timeout=8s, max output 150 tokens
              ├─ 200 + text:  description, description_source='ai_generated',
              │               needs_description_review=true
              ├─ 429 (first): asyncio.create_task → sleep 60s → retry once
              └─ any other failure: description_generation_failed=true (logged)
```

This mirrors the existing "cover image background download" pattern: fresh session inside the task, never touches the request session.

## Backend changes

### Migration `007_add_description_ai_fields.py`

```python
revision = "007"
down_revision = "006"

def upgrade():
    op.add_column("books", sa.Column("description_source", sa.String(length=32), nullable=True))
    op.add_column("books", sa.Column("needs_description_review", sa.Boolean(),
                                      nullable=False, server_default=sa.false()))
    op.add_column("books", sa.Column("description_generation_failed", sa.Boolean(),
                                      nullable=False, server_default=sa.false()))

def downgrade():
    op.drop_column("books", "description_generation_failed")
    op.drop_column("books", "needs_description_review")
    op.drop_column("books", "description_source")
```

Allowed `description_source` values (enforced in app, not DB): `open_library`, `google_books`, `library_of_congress`, `ai_generated`, `manual`. NULL is also valid (rows with no description at all).

### `api/app/services/ai_summary.py` (new)

```python
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TIMEOUT_SECONDS = 8.0
MAX_OUTPUT_TOKENS = 150
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

def build_prompt(title, author, year, publisher) -> str: ...
async def generate_summary_text(meta) -> str | None: ...      # raises RateLimitError on 429
async def generate_and_store_summary(book_id, *, retry_on_rate_limit=True): ...
```

Prompt template (single line, embedded in code):

> Write a 2–3 sentence summary suitable for an eBay book listing for "{title}" by {author} ({year}, {publisher}). Focus on the book's subject matter, likely audience, and key themes. Do not fabricate specific facts not inferable from the metadata.

### `api/app/config.py`
Add `GEMINI_API_KEY: str | None = None`. If unset, no background task is scheduled and the feature is silently disabled.

### `api/app/routers/books.py` `create_book`
Accept `background_tasks: BackgroundTasks`. After successful insert, if `book.description` is empty/None AND `settings.GEMINI_API_KEY` is set, schedule `generate_and_store_summary(book.id)`.

`update_book` (PATCH) is unchanged for AI logic, but **must accept `description_source` and `needs_description_review`** in `BookUpdate` so the frontend can write `description_source = 'manual'` on user edits and toggle the review flag.

### `api/app/models.py` & `api/app/schemas.py`
Three new columns on `Book`. `BookOut` exposes them. `BookUpdate` accepts them as optional.

### `GET /api/books?status=`
Add `"needs_description_review"` to the `Literal[...]`. Update the `"ready"` branch to also require `needs_description_review == False`.

## Frontend changes

### Types — `frontend/src/types.ts`
Add three optional fields to `Book`: `description_source`, `needs_description_review`, `description_generation_failed`.

### `frontend/src/api/books.ts`
No new endpoints (regenerate is deferred). `updateBook` already takes a partial — no signature change needed.

### `PhotoWorkflowPage` polling
After save (entering `'review'` step):
- Start `setInterval` every 1500ms calling `getBook(savedBookId)`.
- Stop when: `book.description_source === 'ai_generated'` OR `book.description_generation_failed === true` OR 12 seconds elapsed OR component unmounts.
- Pass the polled `book` down to `ReviewStep`.

### `ReviewStep`
- New prop `book: Book | null`.
- Add a description block beneath the photography toggle:
  - while `book?.description` is empty AND `!book?.description_generation_failed` → render `Generating summary…` (italic, `secondaryText`).
  - On AI success → render `book.description` text + show **third** review toggle "review description" already ON. Tapping turns it OFF and PATCHes immediately (`onImmediateSave`).
  - On AI failure → clear placeholder, leave field blank (no toggle, no error UI).
- Toggle row layout: stays 2-column until the third toggle is visible, then becomes 3-column. Implement via conditional CSS grid template.

### `BookEditCard`
- Always render the third "review description" toggle alongside metadata + photography. Three-column grid.
- Description field label: render Lucide `Sparkles` icon (14px, `#7F77DD`) when `book.description_source === 'ai_generated'`.
- On commit of a manual description edit, include `description_source: 'manual'` in the PATCH payload so the icon disappears and stays gone.
- No retry UI in this iteration.

### `BookTable` (review column)
Add purple `Sparkles` (`#7F77DD`) when `needs_description_review`. Vertical stack order: amber `FileWarning` → blue `Camera` → purple `Sparkles`. Green `Check` requires all three flags false.

### `StatusFilter`
Insert "Needs description review" between "Needs photography" and "Ready to list". Pass-through to backend `status` query param.

### `theme.ts`
Add `aiPurple: '#7F77DD'` token. Use everywhere the Sparkles icon renders.

## Error handling matrix

| Condition | DB write | User-visible |
|---|---|---|
| `GEMINI_API_KEY` unset | nothing | description empty, no flag |
| HTTP 200 + text | description, source=ai_generated, needs_review=true | placeholder → description → toggle ON |
| HTTP 200 + empty/unusable | description_generation_failed=true | placeholder clears, empty field |
| HTTP 429 (first) | nothing yet | retry scheduled in 60s |
| HTTP 429 (second) | description_generation_failed=true | placeholder clears |
| HTTP 4xx/5xx | description_generation_failed=true | placeholder clears |
| Timeout (8s) | description_generation_failed=true | placeholder clears |

All failures: `logger.warning("ai_summary failed", extra={"book_id": ..., "status": ..., "snippet": ...})`. No API key in logs.

## Tests

**Backend (`api/tests/test_ai_summary.py`, new):**
- `build_prompt` snapshot
- `generate_summary_text` with httpx mocked: 200 success, 200 empty, 429 (raises), 500, timeout
- `generate_and_store_summary`: success path writes fields; 429 → second 429 sets failed flag; bails when description already populated

**Backend (`api/tests/test_books.py`, extend):**
- POST `/books` with `GEMINI_API_KEY` unset: no background task scheduled, no flag set
- POST `/books` with `GEMINI_API_KEY` set + mocked Gemini: background task fires (use `monkeypatch` to replace `generate_and_store_summary` with a spy)
- `?status=needs_description_review` filter returns the right rows
- `?status=ready` filter excludes rows with any of the three review flags

**Frontend (`frontend/src/components/__tests__/BookEditCard.test.tsx`, extend):**
- Renders Sparkles icon when `description_source === 'ai_generated'`
- Renders three toggle buttons when book has the new flags
- Manual description edit sends `description_source: 'manual'` in the PATCH

Skip ReviewStep polling tests — `setInterval` + jsdom is brittle and the logic is thin.

## Env / docs

- `.env.example` (create or extend): `GEMINI_API_KEY=` with a one-line comment pointing at https://aistudio.google.com/app/apikey
- `CLAUDE.md` — new "AI Summaries" section: model name, free tier limits (10 RPM / 500 RPD), feature off when key unset, silent-failure design choice, retry UI deferred.

## Implementation order

1. Worktree `.worktrees/changes-17/`
2. Migration 007 + model/schema fields + alembic upgrade
3. `ai_summary.py` service + unit tests
4. Wire background task into `create_book` + integration test
5. `?status=needs_description_review` filter + ready-filter update
6. Frontend types + theme token
7. ReviewStep description block + polling in PhotoWorkflowPage
8. ReviewStep three-toggle layout
9. BookEditCard third toggle + Sparkles icon + manual-edit `description_source` write
10. BookTable purple Sparkles in review column
11. StatusFilter dropdown option
12. Run full backend + frontend test suites
13. CLAUDE.md update + commit + push

## Out of scope (deferred to FUTURE.md)
- Regenerating existing summaries
- Retry button UI on Review step or edit page
- `POST /books/{id}/regenerate-summary` endpoint
- AI summaries on PATCH or for books that already have a description
