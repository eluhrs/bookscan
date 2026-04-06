````
# BookScan — Iteration 4 Change Document

## Context
This document describes a single major new feature: a multi-step book photography workflow integrated into the existing scan flow. Claude Code should begin by reading CLAUDE.md, SPEC.md, and this file, then explore the codebase thoroughly before planning. This is the most complex feature built so far — Superpowers should decompose it carefully into small tasks before writing any code.

---

## FEAT-01: Multi-Step Book Photography Workflow

### Overview
Replace the current single-screen scan-and-save flow with a three-step workflow: Photograph → Lookup → Review. Users photograph the physical book first, then scan the barcode or enter the ISBN manually, then review and save the complete record. At least one photo is required before a record can be saved.

---

### Consistent Screen Layout
Every screen in the workflow follows the same zone structure from top to bottom:

1. **Header** — BookScan title and Dashboard link, always present
2. **Progress indicator** — centered, always present
3. **Controls bar** — varies per screen
4. **Main content area** — largest zone, varies per screen
5. **Primary button** — large, blue, always present
6. **Cancel** — small gray centered text, always present

This zone structure is consistent across all three steps. The controls bar and main content area change per step — everything else stays in the same position. Implement as a shared wrapper component so all three screens inherit it automatically.

---

### Progress Indicator
Centered below the header on all screens. Uses two states:

- ○ = upcoming or completed
- ● = current step

Example: ○·Photograph  ●·Lookup  ○·Review

Only the current step is filled. No checkmarks — simplicity over status tracking.

---

### Detailed Behavior

**Photograph Step:**
- Controls bar contains a sticky dropdown (left aligned) setting target photo count: options 1-5, defaults to 3, persists via localStorage
- User taps Capture — invokes iOS native camera picker, single photo per tap via input type file with accept image and capture environment attributes
- Each captured photo appears as a thumbnail in the main content area
- When captured photo count reaches the selected target, app automatically advances to Lookup step
- Photos held in browser memory until Save — not uploaded to server until record is committed
- Primary button label: CAPTURE
- Cancel discards all photos and returns to a fresh Photograph screen

**Lookup Step (camera mode):**
- Controls bar contains keyboard icon (left) and torch toggle (right)
- Identical camera functionality to existing barcode scanner
- Keyboard icon switches to manual ISBN entry mode
- Tap Lookup to attempt barcode decode from current frame
- On successful lookup: auto-advances to Review step
- On failed lookup: negative sound plays, hint text updates, user retries
- If lookup returns incomplete data: auto-checks Flag for review on Review screen
- Primary button label: LOOKUP
- Hint text below button: Align barcode and tap Lookup, or use keyboard
- Cancel discards entire in-progress record including photos, returns to fresh Photograph screen

**Lookup Step (keyboard mode):**
- Controls bar contains camera icon (left) to switch back to camera mode
- Main content area shows ISBN text input with numeric keyboard
- User types ISBN-10 or ISBN-13 into text input
- Tap Lookup to submit
- Same success/failure behavior as camera mode
- Primary button label: LOOKUP
- Hint text below button: Type ISBN-10 or ISBN-13
- Cancel discards entire in-progress record including photos, returns to fresh Photograph screen

**Review Step:**
- Controls bar is empty on this screen
- Main content area displays:
  - Cover thumbnail from lookup sources
  - Title, Author, Year, Publisher
  - Condition selector: New, Very Good, Good, Acceptable, Poor — required before Save is enabled
  - Flag for review checkbox — auto-checked if lookup was incomplete, user can override
- Primary button label: SAVE — disabled until condition selected
- Tap Save:
  - Compresses photos client-side (maximum 1200px longest edge, 85% JPEG quality)
  - Uploads photos to server via multipart POST
  - Saves complete record (metadata + condition + photos + review flag) as single transaction
  - Plays positive sound
  - Returns immediately to fresh Photograph screen ready for next book
- Cancel discards entire record including photos, returns to fresh Photograph screen

---

### Data Storage
- Photos stored on server filesystem at /app/photos/{book_id}/
- Claude Code to decide between a book_photos table or JSON array column on books table based on query patterns — document decision in CLAUDE.md
- Existing cover_image_local (fetched from Open Library/Google Books) retained separately — distinct from user-taken photos
- Photos served back to desktop dashboard for display in book detail view

---

### Desktop Dashboard Changes
- Book detail/edit view displays user-taken photos in a simple grid
- Individual photos deletable from dashboard
- Inventory table shows missing photos indicator for records with no user photos

---

### Audio Feedback
Confirm all trigger points work correctly within the new multi-step flow:
- Failed lookup or no barcode found: negative sound
- Successful lookup with complete data: positive sound
- Successful save: positive sound

---

### Retained Functionality
The existing standalone scanner screen (scan without photos) should be retained as a separate route accessible from the dashboard for quick lookups without the full photo workflow. Claude Code to confirm this exists in the current codebase and flag if any changes are needed.

---

### Database Migration
- New book_photos table or column requires an Alembic migration
- Call out migration steps explicitly with exact commands

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning anything
- Use Superpowers to decompose into small tasks — this feature touches frontend state management, native camera API, file upload, backend storage, and dashboard display
- Build and test each step of the flow independently before integrating
- The Photograph step should be built and tested first — it is the most novel piece
- Photo staging in browser memory is critical — photos must not be uploaded until Save is tapped
- The consistent zone layout must be implemented as a shared wrapper component so all three screens inherit it automatically
- Update CLAUDE.md at end of iteration to reflect all changes and decisions made
- For initial development phase and user testing, the agent should perform all database migrations and docker deployments.
- For production deployment, peform github push and provide exact commands for git pull, docker, and any database migrations.
````
