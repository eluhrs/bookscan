## 1. Bug Fixes

### BUG-01: Review flag does not clear on dashboard.  The "needs review" flag on
a book record is not clearing after the record has been edited on the desktop
dashboard.  After a flagged record has been updated, the flag should be cleared
by default but the user should be presented with a clear option to retain the
flag if needed. The flag state should update immediately on the dashboard
without a page refresh.

### BUG-02: CSV export outputs combined/formatted text instead of discrete
fields.  The global CSV export is currently outputting a single combined
eBay-style text blob per record rather than discrete columns. This needs to be
split into proper CSV columns: title, author, publisher, edition, year, pages,
dimensions, weight, subject, description, condition, ISBN, etc.

### BUG-03: Plain text password in .env.  Authentication was set up with a plain
text password due to dollar signs in the password being interpreted as shell
variables during .env parsing. This is a security issue that must be fixed
before any public deployment. Solution: implement proper bcrypt password
hashing. The .env file should store a pre-hashed password value. Provide a
one-time utility script or CLI command the user can run locally to generate the
hash from a chosen password, which they then paste into .env. No plain text
passwords anywhere in the system.

---

## 2. Scanning Improvements (High Priority)

### SCAN-01: Evaluate and potentially replace barcode scanning library.  The
current camera-based barcode scanning is functional but slow and difficult to
trigger reliably. Before making UI changes, Claude Code should evaluate whether
the current library (`zxing-js` or equivalent) is the best option, or whether an
alternative would perform significantly better on mobile browsers. Candidates to
evaluate include `@zxing/browser`, `QuaggaJS`, `Dynamsoft Barcode Reader`, and
`scandit`. Recommend the fastest and most reliable option for ISBN scanning on
mobile, implement it, and document the decision in CLAUDE.md.

### SCAN-02: Replace auto-detect with manual trigger (shutter button).  Remove
continuous auto-detection. Replace with a large, prominent green scan button
displayed below the camera viewfinder. Tapping the button captures the current
frame and attempts to decode the barcode on demand. This is more deliberate,
conserves battery, and gives the user control over when a read is attempted.

### SCAN-03: Constrain the scan area with a targeting mask.  Overlay the camera
viewfinder with a masked rectangle that indicates the active scan zone — similar
to how banking/QR apps focus the camera. Only the area within the rectangle is
analyzed on button press. This reduces noise and should improve decode accuracy.

---

## 3. Phone UI Overhaul

### PHONE-01: Post-scan review flow.  After a successful scan and metadata
lookup, display the retrieved book data on the phone screen for quick review.
The phone review screen should include: - Key fields displayed clearly (title,
author, year, publisher) - A flag for desktop review checkbox/toggle (for
incomplete or questionable data) - Condition selector buttons: New, Very Good,
Good, Acceptable, with Very Good the default - A Save button — on save,
condition is written to the book record, then the UI returns immediately to the
camera for the next scan - Editing on the phone is intentionally minimal — full
editing is for the desktop dashboard

### PHONE-02: Remove desktop scan button The scan button on the desktop
dashboard should be removed entirely. Scanning is a phone-only workflow.

### PHONE-03: Real-time dashboard refresh.  When a new book record is saved from
the phone, the desktop dashboard should automatically update to display the new
record without requiring a manual refresh. Implement via WebSocket or polling —
whichever is simpler and more reliable given the current stack.

---

## 4. Desktop Dashboard Improvements

### DASH-01: Per-row eBay listing copy button Add a copy-to-clipboard button on
each row of the book inventory table. Clicking it copies the fully formatted
eBay listing text for that book (the existing combined format). This replaces
the current export behavior for single-record eBay use.

### DASH-02: Clean CSV export The global CSV export should output discrete field
columns (see BUG-02). This is separate from the per-row eBay copy button — two
distinct functions with two distinct outputs.

---

## 5. Visual Design Overhaul

### DESIGN-01: Apply Geist-inspired design system throughout Redesign both the
desktop dashboard and phone UI using the Geist design language (Vercel's design
system) as the reference. Key characteristics: - **Typography:** Geist Sans for
UI text, Geist Mono for ISBNs and data fields.  Load via Google Fonts or CDN. -
**Color:** Near-monochrome base (white, light grays, dark grays, near-black)
with a single restrained accent color — suggest Vercel blue (#0070F3) or
similar, but Claude Code may propose an alternative - **Layout:** Generous
whitespace, clean grid, subtle borders (1px, low contrast), minimal shadows -
**Components:** Flat buttons with clear states, simple cards, clean tables with
light row separators - **Phone UI:** Same design language, simplified and
lightweight — large touch targets, minimal chrome, the scan viewfinder and green
button should feel native and purposeful - **No heavy gradients, no decorative
elements, no unnecessary animation**

---

## 6. Data Model Change

### DATA-01: Add condition field to books table Add a `condition` field to the
`books` table (VARCHAR, values: New / Very Good / Good / Acceptable). Create and
run the necessary Alembic migration. Ensure this field is included in CSV
export, eBay listing generation, and the desktop edit form.

---

## 7. Scan Audio Feedback

### AUDIO-01: Success and review sounds on book lookup After a barcode is
scanned and the metadata lookup completes, provide audio feedback:

- **Successful lookup (data complete):** Play a positive sound (pleasant chime
or short ascending tone) - **Lookup flagged for review (incomplete data):** Play
a negative sound (low tone or short descending tone) - **Button behavior on
review flag:** Change the scan button label from "Scan" to "Retry" when a record
is flagged for review, so the user knows they can attempt another scan before
saving

Implementation: Claude Code should choose the simplest reliable approach — Web
Audio API (no file dependencies) or small bundled audio files — and document the
choice. Must work on mobile browsers without requiring any special permissions
beyond the camera already in use. Note that mobile browsers require a user
gesture before playing audio — the scan button tap satisfies this requirement,
so audio should work naturally in this flow.

---

## Notes for Claude Code - Address bug fixes first, then scanning improvements,
then UI changes - Scanning library evaluation (SCAN-01) should happen before any
scan UI work — the right UI depends on what the library can do - Design overhaul
(DESIGN-01) should be done last, after all functional changes are in place -
Update CLAUDE.md at the end of this iteration to reflect all changes made -
After each deployable milestone, provide the exact server-side commands to run:
  ``` git pull docker compose up -d --build ```
- If the Alembic migration requires any manual step on the server, call that out
explicitly
