# BookScan — Iteration 23 Change Document

## Context
eBay Seller Hub CSV export from the dashboard. Claude Code should
read CLAUDE.md, SPEC.md, and this file before planning. Use
Superpowers to plan before writing any code. All previous
iterations through CHANGES-22 should already be in place —
the price, category, and archived fields from CHANGES-21
FEAT-02 are required.

Note: photo ZIP export is deferred to CHANGES-24. This iteration
covers CSV only. Photos will be added once CSV format is confirmed
working with a real eBay Seller Hub test upload.

---

## ✓ FEAT-01: eBay export settings in .env

Add the following to .env and .env.example:

```
# eBay export settings — these values must exactly match the names
# configured in your eBay account under Seller Hub → Account →
# Shipping preferences and Return preferences. Case-sensitive.
EBAY_SHIPPING_PROFILE=Media Mail Books
EBAY_SHIPPING_PROFILE_ALT=Standard Mail Books
EBAY_RETURN_POLICY=No Returns
```

Load these values in the backend via the existing settings/config
pattern. They are referenced by the export endpoint.

---

## ✓ FEAT-02: Export button on dashboard

Add an Export button to the dashboard toolbar that appears only
when the Status filter is set to "Ready to list":

- Button label: "Export N records" where N is the count of
  currently visible ready records
- Position: right of the Eye filter button, left of CSV button
- Appearance: same style as existing toolbar buttons
- Hidden when any other status filter is active
- Disabled (grayed) when N = 0
- Clicking triggers the export flow (FEAT-03)

---

## ✓ FEAT-03: CSV export

### What gets exported
All records currently visible with Status=Ready to list. No
per-row selection UI — the filter IS the selection mechanism.

### CSV file
Filename: `bookscan-export-YYYY-MM-DD.csv`
eBay Seller Hub compatible format.

**Important:** Before implementing, download a current bulk
upload template from your eBay Seller Hub account to verify
exact column names. Go to Seller Hub → Listings → Bulk edit
→ Download template. Use those exact column names.

Expected columns:

| Column | Value |
|--------|-------|
| Action | Add |
| Title | {title} by {author} |
| Category | {ebay_category_id} |
| ConditionID | Mapped from condition (see below) |
| Description | {description} |
| StartPrice | {price} |
| Quantity | 1 |
| Format | FixedPrice |
| Duration | GTC |
| ShippingProfileName | {EBAY_SHIPPING_PROFILE} |
| ReturnProfileName | {EBAY_RETURN_POLICY} |
| PictureName | {isbn}_1.jpg,{isbn}_2.jpg,... |
| CustomLabel | {isbn} |
| ISBN | {isbn} |

**Condition mapping (BookScan → eBay ConditionID):**
- Very Good → 4000
- Good → 5000
- Acceptable → 6000

### Download behavior
CSV downloads automatically when Export is clicked.

---

## ✓ FEAT-04: Post-export archiving and undo

### Archiving
After CSV is generated and download triggered:
- Set archived=true on all exported records
- Store exported batch in database for persistent undo

### New database table: export_batches
```sql
CREATE TABLE export_batches (
    id SERIAL PRIMARY KEY,
    exported_at TIMESTAMP NOT NULL DEFAULT NOW(),
    book_ids JSONB NOT NULL
);
```

Only one batch tracked at a time. New export replaces previous
batch record. Provide exact Alembic migration.

### Undo banner
Show persistent banner at top of dashboard after export:

```
✓ {N} records exported and archived.  [Undo]  [×]
```

- Persists across sessions — driven by database, not session
  state
- [Undo]: sets archived=false on all batch book IDs, deletes
  batch record, dismisses banner
- [×]: deletes batch record, dismisses banner, no undo after
- New export replaces previous batch — old undo no longer
  available
- No banner shown when no export batch exists

---

## Implementation Order
1. FEAT-01 — .env settings
2. FEAT-04 (database) — export_batches migration
3. FEAT-02 — Export button UI
4. FEAT-03 — CSV generation logic
5. FEAT-04 (UI) — banner and undo

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

   **Environment:**
   - [ ] EBAY_SHIPPING_PROFILE in .env and .env.example
   - [ ] EBAY_SHIPPING_PROFILE_ALT in .env and .env.example
   - [ ] EBAY_RETURN_POLICY in .env and .env.example
   - [ ] Comment explains values must match eBay exactly,
     case-sensitive

   **Export button:**
   - [ ] Appears only when Status=Ready to list is active
   - [ ] Shows correct record count
   - [ ] Hidden for all other status filters
   - [ ] Disabled when count is 0

   **CSV export:**
   - [ ] Filename includes today's date
   - [ ] All required columns present
   - [ ] Column names verified against current Seller Hub template
   - [ ] Condition mapped correctly to eBay condition IDs
   - [ ] Shipping profile name matches .env value
   - [ ] Return policy name matches .env value
   - [ ] PictureName lists all photos for each record
   - [ ] CustomLabel contains ISBN
   - [ ] One row per exported record
   - [ ] CSV downloads automatically on Export click

   **Archiving and undo:**
   - [ ] All exported records set to archived=true after export
   - [ ] export_batches table created and populated
   - [ ] Undo banner appears after export
   - [ ] Banner persists across sessions
   - [ ] Undo sets archived=false on all batch records
   - [ ] Undo deletes export batch record and dismisses banner
   - [ ] Dismiss deletes batch record, no undo after
   - [ ] New export replaces previous batch record
   - [ ] No banner when no export batch exists

6. Report back with summary of completed work, anything
   unfinished, and decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- Download current Seller Hub bulk upload template before
  implementing CSV — column names must be verified against
  the actual template, not documentation
- Photo ZIP export is intentionally deferred to CHANGES-24 —
  do not implement photo handling in this iteration
- PictureName column should reference photo filenames as they
  will be named in the CHANGES-24 ZIP — format: {isbn}_{n}.jpg
- Never join shell commands with && — run each as a separate
  tool call
- Do not push to GitHub until explicitly instructed
- Update CLAUDE.md at end of iteration per End of Iteration
  Tasks above
