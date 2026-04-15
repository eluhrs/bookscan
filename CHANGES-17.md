# BookScan — Iteration 17 Change Document

## Context
AI-generated book description summaries using Gemini Flash free tier. Summaries generate asynchronously after record creation, populate the description field, and set a review toggle. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. All previous iterations through CHANGES-16 should already be in place.

**Status:** Implementation complete — 2026-04-14. Retry UI deferred per design decision; see docs/superpowers/specs/2026-04-14-changes-17-ai-summaries-design.md.

---

## Overview
When a book record is created and the description field is empty after all existing lookup sources (Open Library, Google Books, Library of Congress), trigger an asynchronous AI summary request to Gemini Flash. The summary populates the description field and sets the "review description" toggle ON. The user reviews it on the Review step or later on the edit page and turns the toggle OFF when satisfied.

---

## Backend Changes

### ✓ FEAT-01: Gemini Flash integration
Add Gemini Flash API integration for book summary generation:
- API key stored in .env as `GEMINI_API_KEY`
- Use Gemini 1.5 Flash free tier endpoint
- Prompt: generate a 2-3 sentence summary suitable for an eBay book listing, using available metadata: title, author, year, publisher. Focus on the book's subject matter, likely audience, and key themes. Do not fabricate specific facts not inferable from the metadata.
- Maximum response: 150 tokens
- Timeout: 8 seconds — if no response within 8 seconds, treat as failure
- Do not retry automatically — surface failure state for manual retry on edit page

### ✓ FEAT-02: Asynchronous summary generation
- Trigger after successful POST /books (record creation) only — not on PATCH
- Run as a background task (FastAPI BackgroundTasks) — do not block the POST response
- POST response returns immediately with the new record
- Background task: call Gemini, on success update description field and set needs_description_review = true, on failure set description_generation_failed = true
- No summary generation on records that already have a description from lookup sources

### ✓ FEAT-03: Database changes
Add two new fields to the books table via Alembic migration:
- `description_source` VARCHAR — tracks origin of description content. Values: open_library, google_books, library_of_congress, ai_generated, manual. Populate retroactively where possible from existing data, otherwise null.
- `needs_description_review` BOOLEAN — default false. Set to true when AI summary arrives. User sets to false when satisfied.
- `description_generation_failed` BOOLEAN — default false. Set to true if Gemini request fails or times out. Used to show retry indicator on edit page.

Provide exact Alembic migration commands.

---

## Review Step Changes (Scan Workflow)

### ✓ FEAT-04: Description field on Review step
Add a description field to the Review step of the scan workflow, below the review photography toggle:
- Initial state (waiting for AI): shows placeholder text "Generating summary..." in italic tertiary color, non-editable
- On AI success: description text fills in, "review description" toggle appears and turns ON (blue) automatically
- On AI failure: shows "Summary unavailable" in italic tertiary color, small retry icon button
- If summary arrives after user has already saved: no visible change on Review step — state is correct on edit page when opened
- Field is read-only on the Review step — full editing on edit page only

### ✓ FEAT-05: Review description toggle on Review step
Add "review description" as a third toggle button on the Review step, alongside "review metadata" and "review photography":
- Appears only once AI summary has arrived (or failed)
- While generating: toggle not shown — description field shows "Generating summary..." only
- On AI success: toggle appears already ON (blue) — user can turn OFF if satisfied
- On AI failure: toggle not shown — retry indicator on description field instead
- Three toggles layout: equal width, three-column grid (review metadata / review photography / review description)
- Same toggle button style as existing two: off = white/gray border, on = #0070F3 fill

---

## Edit Page Changes

### ✓ FEAT-06: Review description toggle on edit page
Add "review description" toggle to the edit page alongside existing review metadata and review photography toggles:
- Three toggles in a three-column grid, equal width
- Same toggle button style as existing two
- Reflects state saved from Review step or subsequent edits
- Saves immediately on toggle — no Save button needed
- If description_generation_failed is true: show small retry icon next to the description field label. Tapping retry fires a new Gemini request, shows "Generating..." in the field, updates on response.

### ✓ FEAT-07: Description field source indicator
When description_source is ai_generated, show a small Lucide Sparkles icon next to the "description" field label on the edit page. Icon is purely informational — indicates AI origin. Icon disappears if the user manually edits the description field (description_source updates to manual on any manual edit).

---

## Dashboard Changes

### ✓ FEAT-08: AI review indicator in review column
Add Lucide Sparkles icon to the review column on the dashboard:
- Color: purple (#7F77DD from Geist purple ramp) — distinct from amber (metadata) and blue (photography)
- Visible when needs_description_review is true
- Stacks vertically with other review icons if multiple flags set
- Clears when needs_description_review is set to false

### ✓ FEAT-09: Status filter dropdown update
Add "Needs description review" as a new option in the status filter dropdown (CHANGES-16 FEAT-05):
- Insert between "Needs photography" and "Ready to list"
- "Ready to list" now means: no metadata review, no photography review, AND no description review needed

---

## API Key Setup
Claude Code should:
1. Add GEMINI_API_KEY to .env.example with a placeholder value and a comment explaining how to obtain a free key at aistudio.google.com
2. Add GEMINI_API_KEY to the existing .env file instructions in CLAUDE.md
3. Document the free tier limits in CLAUDE.md: 15 requests per minute, 1 million tokens per day — well within expected usage at ~1 request per book scan

---

## Failure Handling
- API timeout (>8 seconds): set description_generation_failed = true, surface retry on edit page
- API error response: same as timeout
- Empty or unusable response: same as timeout
- Rate limit hit: queue retry after 60 seconds using FastAPI BackgroundTasks — do not surface to user unless retry also fails
- All failures must be logged server-side for debugging

---

## What Is Not In Scope
- Regeneration of existing summaries (deferred to FUTURE.md)
- AI summaries for records that already have descriptions from lookup sources
- Summary generation on PATCH/edit — POST only
- Any AI feature beyond description summary generation

---

## Implementation Order
1. FEAT-03 — database migration first, everything else depends on it
2. FEAT-01 — Gemini integration, test independently before wiring up
3. FEAT-02 — async background task, test with real API key
4. FEAT-04 — description field on Review step
5. FEAT-05 — review description toggle on Review step
6. FEAT-06 — review description toggle on edit page
7. FEAT-07 — Sparkles icon on description field
8. FEAT-08 — Sparkles icon in dashboard review column
9. FEAT-09 — update status filter dropdown

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move completed iteration history to docs/HISTORY.md if CLAUDE.md exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist:

   **Backend:**
   - [ ] GEMINI_API_KEY in .env works correctly
   - [ ] Summary generates after record creation when description is empty
   - [ ] Summary does NOT generate when description already exists from lookup
   - [ ] Summary does NOT generate on PATCH requests
   - [ ] API timeout handled gracefully — description_generation_failed set correctly
   - [ ] Rate limit handling works — retry after 60 seconds
   - [ ] description_source field populated correctly for new and existing records

   **Review step:**
   - [ ] "Generating summary..." placeholder shows immediately after save
   - [ ] Description fills in automatically when AI response arrives (1-3 seconds)
   - [ ] review description toggle appears and turns ON when summary arrives
   - [ ] Toggle can be turned OFF immediately if summary looks good
   - [ ] "Summary unavailable" shows on API failure with retry button
   - [ ] Three toggles display correctly in three-column grid

   **Edit page:**
   - [ ] Three review toggles present: metadata, photography, description
   - [ ] All three save immediately on toggle
   - [ ] Sparkles icon visible next to description label when source is ai_generated
   - [ ] Sparkles icon disappears when description is manually edited
   - [ ] Retry button visible when description_generation_failed is true
   - [ ] Retry fires new Gemini request and updates field on success

   **Dashboard:**
   - [ ] Purple Sparkles icon appears in review column when needs_description_review is true
   - [ ] Sparkles stacks correctly with other review icons
   - [ ] "Needs description review" option in status filter dropdown
   - [ ] "Ready to list" filter correctly excludes records with any review flag set

   **Database:**
   - [ ] description_source field present and populated
   - [ ] needs_description_review field present, defaults false
   - [ ] description_generation_failed field present, defaults false
   - [ ] Migration runs cleanly

7. Provide exact server deployment commands:
```
   git pull
   docker compose up -d --build
```
   Note: database migration required — provide exact migration commands.
8. Report back with a brief summary of what was completed, what if anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- Test Gemini API integration independently before wiring into the scan workflow
- The background task must not block the POST response under any circumstances
- description_source = manual must be set any time the user manually edits the description field
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
