# CHANGES-24: Photo ZIP Export — Design Spec

## Overview

Single-click export produces one ZIP file containing the eBay CSV and all
photos (covers + user photos) for the exported batch. Covers are upgraded
to full-size at lookup time so no external fetch is needed during export.

---

## FEAT-01: Photo ZIP Export

### Endpoint change

Replace `POST /api/exports` response. Currently returns a CSV
(`text/csv`). After this change it returns a ZIP (`application/zip`)
containing:

```
bookscan-export-YYYY-MM-DD.zip
├── bookscan-export-YYYY-MM-DD.csv
└── photos/
    ├── 9780123456789_1.jpg   (cover from /app/covers/)
    ├── 9780123456789_2.jpg   (user photo 1)
    ├── 9780123456789_3.jpg   (user photo 2)
    └── ...
```

Flat structure inside `photos/` — all books' images in one directory,
disambiguated by ISBN prefix.

### Photo collection (all local reads)

1. **Cover image**: read from `/app/covers/{isbn}.jpg` if
   `cover_image_local` is set and the file exists. If missing, skip —
   log a warning, do not abort.
2. **User photos**: read from `/app/photos/{book_id}/{photo_id}.jpg`
   in `created_at` order (same as existing query).

### Numbering

- Cover (if present) is `{isbn}_1.jpg`
- User photos follow: `{isbn}_2.jpg`, `{isbn}_3.jpg`, ...
- If no cover exists, user photos start at `{isbn}_1.jpg`

### PictureName column in CSV

Must match the actual ZIP contents. Build the list after collecting
photos for each book — the filenames written into the ZIP are the same
strings that go into PictureName (comma-separated).

### Archiving and batch tracking

No change — same logic as CHANGES-23. Archive books, create/replace
batch, undo/dismiss work identically.

### Error handling

- Missing cover file: skip, log warning, continue
- Missing user photo file: skip, log warning, continue
- Zero photos for a book: book still appears in CSV with empty
  PictureName (same as current behavior)
- ZIP built in memory (`io.BytesIO`) — acceptable for typical batch
  sizes (dozens of books, ~100 photos)

---

## Cover size upgrade (lookup time)

Small change in `api/app/services/lookup.py`:

- **Open Library**: prefer `covers["large"]` over `covers["medium"]`.
  Fall back to medium if large is absent.
- **Google Books**: on the thumbnail URL, remove the `&zoom=1`
  parameter (or set `zoom=0`) and remove `&edge=curl` if present.
  This returns the original full-size image.

Existing books with small covers are unaffected — no bulk re-fetch.
New lookups will get full-size covers going forward.

---

## FEAT-02: Export button label

Update the dashboard Export button text from `Export ${total}` to
`Export ${total} (CSV + photos)`. The `Exporting...` state stays as-is.

---

## Frontend changes

`exportBooks()` in `frontend/src/api/exports.ts`:

- Response is now `application/zip` instead of `text/csv`
- Filename extracted from Content-Disposition (already works)
- No other changes needed — same blob download logic

---

## What doesn't change

- Batch tracking, undo, dismiss — identical
- Dashboard undo banner — identical
- Export button visibility rules — identical (ready filter + desktop only)
- Backend archiving logic — identical
