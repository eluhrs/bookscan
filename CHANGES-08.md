# BookScan — Iteration 8 Change Document
## Status: COMPLETE (implemented and merged to master)

All items implemented. No DB migration required — `needs_photo_review` from migration 004 serves as `needs_photography`. Zone 2 retained at standard height after post-implementation correction. 54 frontend + 48 backend tests passing.

---


## Context
Wireframe alignment pass for the Review screen. Claude Code should read CLAUDE.md, SPEC.md, and this file, examine the wireframe at docs/wireframes/changes-06-wireframe.png, then use Superpowers to plan before writing any code. Continue on the existing worktree branch and do not merge to main under any circumstances. Global design items from CHANGES-07 (button heights, #F0F0F0 zones, case conventions) should already be in place — do not re-implement them.

## Already Implemented (do not re-implement)
The following items were completed as part of CHANGES-07 and are already in the codebase:
- Dropdown extends 0-5; selecting 0 hides □ indicators and changes CAPTURE button to SKIP
- Tapping SKIP advances to Metadata step and auto-checks "Review Photography?" on Review screen
- "Review Metadata?" checkbox rename — was "Mark for Review?"
- "Review Photography?" checkbox exists and is auto-checked when SKIP was used

---

## Review Screen

### FEAT-01: Remove toolbar border
The Review screen controls bar is empty — remove the 1px border that appears on other screens. No controls = no border needed. The #F0F0F0 header zone provides sufficient visual separation.

### FEAT-02: Scrollable image filmstrip
Replace current layout with a horizontal scrollable filmstrip as the first content element below the controls bar:
- Cover image (from lookup) appears first, leftmost
- User-captured photos follow in capture order
- Fixed height filmstrip, scrollable horizontally if many photos
- Cover image: no ✕ button — it is a lookup result, not deletable here
- User photos: each has a small ✕ button to delete
- If all user photos are deleted: auto-check "Review Photography?" checkbox
- If 0 photos were taken (SKIP used): filmstrip shows cover image only, "Review Photography?" already auto-checked from CHANGES-07

### FEAT-03: Cover image visual distinction
Subtle visual distinction between cover image and user photos in filmstrip:
- Cover image: thin colored border or slightly rounded corner style to signal it is a lookup result, not a user photo
- User photos: standard filmstrip style with ✕

### BUG-01: Title and author text sizing
- Title: larger bold font, two-line max with ellipsis if longer
- Author: one-line max with ellipsis if longer
- Year · Publisher: one line, smaller secondary text
- Apply same two-line/one-line ellipsis rule to title/author columns on /dashboard as well

### FEAT-04: Review Photography? checkbox — complete implementation
The checkbox UI exists from CHANGES-07 but needs full implementation:
- **Database migration required:** add `needs_photography` boolean field to books table (default false). This field is needed for the dashboard Actions column in CHANGES-10. Document exact migration commands.
- Auto-check when all user photos deleted from filmstrip
- Auto-check when SKIP used — already implemented, confirm still works after migration
- Unchecked by default if 1+ photos present
- User can manually check/uncheck regardless of auto-check state
- Persist state to database on Save

### BUG-02: SAVE button state
- SAVE button: blue (#0070F3) when condition is selected
- SAVE button: grayed out and disabled when no condition selected
- Confirm this behavior is correctly implemented after layout changes

### FEAT-05: Full layout structure
Confirm full Review screen layout matches this order top to bottom:
1. #F0F0F0 step indicator zone (from CHANGES-07 global)
2. Empty controls bar — no border
3. Scrollable filmstrip (cover + user photos)
4. Title (bold, two-line max)
5. Author (one-line max)
6. Year · Publisher (secondary text)
7. Condition buttons: New · Very Good · Good · Acceptable · Poor
8. Review Metadata? checkbox
9. Review Photography? checkbox
10. SAVE button (blue, full width, same height as CAPTURE/LOOKUP)
11. #F0F0F0 bar: Dashboard (left) | Start Over (right)

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Examine docs/wireframes/changes-06-wireframe.png before planning
- Use Superpowers to decompose into small tasks
- Global items from CHANGES-07 should already be implemented — do not re-implement
- The filmstrip is the most novel piece — build and test it first
- FEAT-04 requires a database migration — flag the exact commands explicitly
- Continue on existing worktree branch — do not merge to main under any circumstances
- Update CLAUDE.md at end of iteration
- After deployment provide exact server commands:
```
  git pull
  docker compose up -d --build
```
- One database migration expected for needs_photography field — provide exact commands
