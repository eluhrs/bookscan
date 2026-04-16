# CHANGES-25 — eBay Export Overhaul

## Context
This iteration fixes the eBay CSV export to match the actual Seller Hub bulk listing template
format, replaces the ZIP-based photo export with signed photo URLs served from the app,
updates the category selection UI to use real eBay category IDs, and adds a payment profile
.env variable. CHANGES-24 must be complete before starting this iteration.

Read CLAUDE.md, SPEC.md, and this file before planning. Review FUTURE.md — do not implement
anything listed there.

---

## Background: What We Learned from the eBay Template

We downloaded the official eBay Seller Hub "Create or Schedule new listings" XLSX template
for the Books & Magazines category group. Key findings that drive this iteration:

- Column names differ significantly from what CHANGES-23/24 implemented
- Photos must be publicly accessible URLs, not bundled files
- The Action column header has a specific verbose format required by eBay
- ISBN is P:ISBN, not a standalone ISBN column
- Condition is "Condition ID" (with space), not "ConditionID"
- Category requires both a numeric "Category ID" and a "Category name" column
- eBay's book category structure is flat: almost all books list under category 261186 (Books)
- C:Author, C:Book Title, and C:Language are REQUIRED item specifics for category 261186
- C:Topic, C:Genre, C:Binding and other PREFERRED/OPTIONAL fields are intentionally omitted —
  these can be enriched in Seller Hub after import if desired

---

## Environment Variables ✓

Add to .env on both local dev and production, with comments exactly as shown:

    # Photo signing secret — used to generate time-limited signed URLs for eBay image crawling
    # Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
    PHOTO_SIGNING_SECRET=

    # eBay Business Policy names — must exactly match names in eBay Seller Hub
    # Account → Business Policies. Case-sensitive.
    EBAY_PAYMENT_PROFILE=

Generate the PHOTO_SIGNING_SECRET value immediately using the command above and populate
it in .env on both servers. Leave EBAY_PAYMENT_PROFILE blank until the value is confirmed
from Seller Hub.

These join the existing eBay .env vars:

    EBAY_SHIPPING_PROFILE=Media Mail Books
    EBAY_SHIPPING_PROFILE_ALT=Standard Mail Books
    EBAY_RETURN_POLICY=No Returns

Add EBAY_PAYMENT_PROFILE and PHOTO_SIGNING_SECRET to the FastAPI settings/config model
alongside the existing eBay env vars.

---

## Database Migration

### MIGRATION-01 — Backfill and default ebay_category_id ✓

Create an Alembic migration that:
1. Backfills all existing records where ebay_category_id IS NULL to 261186
2. Sets the column default to 261186
3. Does NOT change the column type (remains INTEGER nullable — NULL still valid if needed)

Note: Test data can be wiped manually if preferred, but the migration handles either case
safely.

---

## Backend Changes

### BACK-01 — Public signed photo URL endpoint ✓

Add a new unauthenticated route for serving book photos with time-limited signed URLs:

Route: GET /photos/{filename}

Where filename follows the existing convention: {isbn}_{n}.jpg

Signing mechanism:
- Use Python's hmac module with the secret key from PHOTO_SIGNING_SECRET in .env
- Generate signed URLs with an expires Unix timestamp parameter and a token HMAC
  signature parameter
- Example: https://bookscan.luhrs.net/photos/9780743273565_1.jpg?expires=1234567890&token=abc123
- Expiry window: 48 hours from export time
- On request: verify token and check expires > now(). Return 404 if invalid or expired.
- On valid request: serve the photo file from the existing photo storage location

Helper function: Add generate_signed_photo_url(isbn, n, base_url) to a shared utility
module. The export endpoint (BACK-02) will call this for each photo.

This route is intentionally narrow — it serves only photo files and performs no other
function. It does not expose any other app data.

### BACK-02 — Replace export endpoint ✓

Replace the existing POST /api/exports endpoint entirely. Remove the ZIP response.
The new endpoint returns a CSV file directly.

Behavior:
- Exports all currently visible "ready to list" records (same selection logic as before)
- Returns Content-Type: text/csv with filename: bookscan-export-YYYY-MM-DD-HHmm.csv
- Post-export archiving and undo banner behavior unchanged (records set to archived=true,
  export_batches table updated)

CSV format — exact column headers required by eBay:

Column header                                                  | Source                    | Notes
*Action(SiteID=US|Country=US|Currency=USD|Version=1193)        | hardcoded                 | Value: Add
Custom label (SKU)                                             | books.isbn                |
Category ID                                                    | books.ebay_category_id    | Integer, e.g. 261186
Category name                                                  | derived from category ID  | See mapping table below
Title                                                          | books.title               |
P:ISBN                                                         | books.isbn                |
Start price                                                    | books.price               | Decimal, e.g. 12.99
Quantity                                                       | hardcoded                 | 1
Item photo URL                                                 | signed URLs               | Pipe-separated, 48hr expiry. Omit value if no photos.
Condition ID                                                   | books.condition           | See condition mapping below
Description                                                    | books.description         |
Format                                                         | hardcoded                 | FixedPrice
Duration                                                       | hardcoded                 | GTC
Shipping profile name                                          | EBAY_SHIPPING_PROFILE     |
Return profile name                                            | EBAY_RETURN_POLICY        |
Payment profile name                                           | EBAY_PAYMENT_PROFILE      | Omit value if env var not set
C:Book Title                                                   | books.title               | REQUIRED by eBay for category 261186
C:Author                                                       | books.author              | REQUIRED by eBay for category 261186
C:Language                                                     | hardcoded                 | English — see note below

Category ID to Category name mapping (hardcoded in backend):

    EBAY_CATEGORY_NAMES = {
        261186: "Books",
        29223: "Antiquarian & Collectible",
        1105: "Textbooks",
        69496: "Maps & Atlases",
    }

Condition mapping (unchanged from CHANGES-23):

    CONDITION_MAP = {
        "Very Good": 4000,
        "Good": 5000,
        "Acceptable": 6000,
    }

Photo URL generation:
- For each book, query user-taken photos (not cover images — unchanged from CHANGES-24
  decision)
- Generate a signed URL for each photo using the helper from BACK-01
- Join with pipe character: url1|url2|url3
- If a book has no user photos, leave the Item photo URL cell empty

Note on C:Language: Defaulted to English for all exports. Future work: add language field
to scan workflow for non-English books. Document in FUTURE.md as noted in End of Iteration
Tasks below.

Do not include: C:Topic, C:Genre, C:Binding, or any other PREFERRED/OPTIONAL item
specifics. These are intentionally omitted and can be added in Seller Hub after import.

---

## Frontend Changes

### FRONT-01 — Replace category dropdown with 4 eBay categories ✓

Update the category selection button on both the desktop Edit page and Review step.

New category options (label shown in button → ID stored in DB):

Button label   | ebay_category_id stored | ebay_category_name stored
Books          | 261186                  | Books
Antiquarian    | 29223                   | Antiquarian & Collectible
Textbooks      | 1105                    | Textbooks
Atlases        | 69496                   | Maps & Atlases

Default behavior (important change from current):
- New records: ebay_category_id defaults to 261186, button renders pre-selected blue
  showing "Books"
- Existing records after migration: same — backfilled to 261186, renders as selected blue
- "Books" pre-selected counts as category set for "ready to list" computation — no user
  tap required

Button display:
- Unset (NULL): gray, no label — should not occur after migration but handle gracefully
- Set: full blue fill, white text, "CATEGORY" label + divider + category button label
- Selected label text: full label as listed above (Books / Antiquarian / Textbooks / Atlases)
- Remove the Lucide Check icon — replace with the category label text
- If label text does not fit at current font size, reduce label font size slightly
  (not value text). Test specifically with "Antiquarian" as the longest option.
- Button layout and dimensions otherwise unchanged (same height, same 50/50 split with
  Price button, same border-radius)

Dropdown options: The four options listed above in order. No "Other" option.

On selection: Save ebay_category_id (integer) and ebay_category_name (the full eBay name
string, e.g. "Antiquarian & Collectible") to the database. Display uses the short button
label.

Scope note: This change applies to desktop Edit page and Review step only, consistent with
existing category button behavior. Do not add category selection to mobile-only views.

---

## Notes for Claude Code

- The Action column header contains pipe characters and equals signs — ensure CSV escaping
  handles this correctly. Test the output CSV by opening it in a spreadsheet app before
  considering the feature complete.
- The existing ZIP export code from CHANGES-24 is fully removed — do not leave dead code
  or unused imports.
- Add the new .env variables on both local dev and production with comments exactly as
  shown in the Environment Variables section above. Generate PHOTO_SIGNING_SECRET
  immediately using the command in the comment — do not leave it blank.
- EBAY_PAYMENT_PROFILE may be blank — the export must not crash if this env var is empty
  or missing. Either omit the value or write an empty string in the CSV cell.
- Do not implement anything in FUTURE.md. Specifically: do not add language selection to
  the scan workflow, do not add C:Topic or C:Genre population, do not add C:Binding.
- Run existing tests after implementation. Note any pre-existing failures in the
  end-of-session report rather than fixing them silently.
- After implementation, generate a small test CSV (2-3 rows of fake data) and verify the
  Action column header renders correctly and the file opens cleanly in a spreadsheet.
- Never join shell commands with &&. Run each as a separate tool call.

---

## Implementation Order

1. MIGRATION-01 — DB migration (backfill + default). Run and verify before touching
   frontend or export logic.
2. BACK-01 — Signed photo URL endpoint. Implement and test independently.
3. BACK-02 — Replace export endpoint. Depends on BACK-01 for photo URL generation.
4. FRONT-01 — Category button UI. Can be done in parallel with BACK-01/02 but test
   after BACK-02 is complete to verify full export flow end to end.

---

## End of Iteration Tasks

When all items in this document are complete, perform the following in order without
being asked:

1. Update CLAUDE.md to reflect current project state. Move completed iteration history
   to docs/HISTORY.md if CLAUDE.md exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Add to FUTURE.md:
   - "Language selection in scan workflow — C:Language hardcoded to English in eBay
     export; some inventory may be in other languages"
   - "C:Binding capture in scan workflow — currently omitted from eBay export"
   - "C:Topic and C:Genre population from catalog subject data — mapping layer needed
     between library catalog vocabulary and eBay controlled terms"
4. Commit all changes with a meaningful message
5. Push to GitHub
6. Restart the local development server
7. Print a QA checklist organized by feature area covering:
   - Migration: verify existing records have ebay_category_id = 261186
   - Signed URLs: verify a photo URL is accessible before expiry and returns 404 after
   - CSV export: verify column headers exactly match eBay template, open in spreadsheet
     to confirm no encoding issues with the Action header
   - CSV export: verify pipe-separated photo URLs appear correctly for books with
     multiple photos
   - CSV export: verify books with no photos have empty Item photo URL cell
   - Category button: verify Books pre-selected blue on new and existing records
   - Category button: verify all 4 options selectable and value persists after save
   - Category button: verify "Antiquarian" label fits without truncation on mobile
   - End-to-end: export a batch, verify archived + undo banner still works
8. Remind developer to:
   - Confirm PHOTO_SIGNING_SECRET has been generated and populated in .env on both
     local dev and production — do not leave it blank
   - Add EBAY_PAYMENT_PROFILE to .env on both local and production once value is known
     from Seller Hub (Account → Business Policies)
   - Verify CSV column names against eBay Seller Hub before first production upload
9. Report back with summary of completed work, anything unfinished, and decisions or
   issues to revisit
