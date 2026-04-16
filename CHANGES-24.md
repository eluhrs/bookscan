# BookScan — Iteration 24 Change Document
# DEFERRED — implement after CHANGES-23 CSV export is confirmed
# working with a real eBay Seller Hub test upload.
# stored in docs/ to avoid being picked up by START-SESSION.

## Context
Photo ZIP export to accompany the eBay Seller Hub CSV generated
in CHANGES-23. Do not implement until CHANGES-23 CSV format has
been validated with a real eBay test upload. Claude Code should
read CLAUDE.md, SPEC.md, and this file before planning. Use
Superpowers to plan before writing any code.

---

## ✓ FEAT-01: Photo ZIP export

### What gets included
All photos for all records exported in the current CSV batch.
ZIP is generated alongside the CSV when Export is clicked.

### ZIP file
Filename: `bookscan-photos-YYYY-MM-DD.zip`

Photo naming convention: `{isbn}_{n}.jpg`
- n starts at 1
- Cover image (from external URL or local) → `{isbn}_1.jpg`
- User photos in order → `{isbn}_2.jpg`, `{isbn}_3.jpg`, etc.

### Photo sources
- Cover images: fetched from external URL (Open Library,
  Google Books). Handle fetch failures gracefully — skip
  missing cover, log warning, continue with remaining photos.
  Do not abort the entire ZIP for a single missing cover.
- User photos: included from local storage path

### Download behavior
ZIP downloads automatically alongside CSV when Export is
clicked. Both files download in sequence.

### Update PictureName in CSV
CHANGES-23 includes PictureName column with placeholder
filenames. Verify these match the actual ZIP contents —
`{isbn}_1.jpg`, `{isbn}_2.jpg` etc. per book.

---

## ✓ FEAT-02: Update export button label
Update Export button label to reflect both files:
"Export N records (CSV + photos)"

---

## Implementation Order
1. FEAT-01 — photo collection and ZIP generation
2. FEAT-02 — update button label

---

## End of Iteration Tasks
When all items in this document are complete, perform the
following in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move
   completed iteration history to docs/HISTORY.md if CLAUDE.md
   exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message
4. Do not push to GitHub until explicitly instructed
5. Print a bulleted QA checklist:

   **Photo ZIP:**
   - [ ] ZIP filename includes today's date
   - [ ] Cover images fetched from URL and included
   - [ ] Cover image fetch failures handled gracefully —
     skipped with warning, export continues
   - [ ] User photos included from local storage
   - [ ] All photos named {isbn}_{n}.jpg
   - [ ] Numbering starts at 1
   - [ ] ZIP downloads automatically alongside CSV
   - [ ] PictureName column in CSV matches ZIP contents

   **Export button:**
   - [ ] Label updated to reflect CSV + photos

6. Report back with summary of completed work, anything
   unfinished, and decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Do not implement until CHANGES-23 CSV has been validated
  with a real eBay Seller Hub test upload
- Use Superpowers to decompose into small tasks
- Cover image fetch is a network operation — implement with
  timeout and graceful failure handling
- Never join shell commands with && — run each as a separate
  tool call
- Do not push to GitHub until explicitly instructed
- Update CLAUDE.md at end of iteration per End of Iteration
  Tasks above
