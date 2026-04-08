# BookScan — Iteration 7 Change Document

## Status: COMPLETE (2026-04-08)

All items implemented. 44 frontend tests + 48 backend tests pass. Migration 004 (`needs_photo_review`) required on deploy.

Key commits: `add434e` theme tokens · `529dbb9` controlsBorder token · `f45f02a` square mask · `95ca116` SKIP state · `64ccae6` LookupStep camera · `254720c` LookupStep keyboard · `3ece67d` ReviewStep · `afefb1a` test fixes · `32a720e` CLAUDE.md conventions + tests

---

## Context
Wireframe alignment pass for the Photograph and Metadata screens, plus global design convention fixes that touch all screens. Claude Code should read CLAUDE.md, SPEC.md, and this file, examine the wireframe at docs/wireframes/changes-06-wireframe.png, then use Superpowers to plan before writing any code. Continue on the existing worktree branch and do not merge to main under any circumstances.

## Global Items (apply to all screens before touching individual screens)

### FEAT-01: Button case convention
- Primary action buttons: ALL CAPS — CAPTURE, LOOKUP, SAVE, SKIP
- Hint text references to buttons: Title Case — "tap Lookup", "tap Capture"
- Apply consistently across all workflow screens
- Document as a design convention in CLAUDE.md under a new "Design Conventions" section

### FEAT-02: #F0F0F0 header background
- Step indicator zone (#F0F0F0) on all workflow screens
- Applies to Photograph, Metadata camera, Metadata keyboard, and Review screens
- Implement once in the shared WorkflowWrapper component so it applies globally

### FEAT-03: Lower button bar background
- Dashboard / Start Over button bar background: #F0F0F0
- Applies to all workflow screens
- Implement in shared WorkflowWrapper component

### FEAT-04: "Cancel" renamed "Start Over"
- Rename Cancel to Start Over on all workflow screens
- Start Over: discards entire in-progress record including photos, returns to fresh Photograph screen
- Dashboard: navigates to dashboard, discards in-progress record
- Apply consistently across all four workflow screens

---

## Photograph Screen

### BUG-01: Square mask
Replace current portrait rectangle mask with the largest square that fits within the portrait camera view. Square accommodates both portrait and landscape orientation books without excessive dead space on either axis.

### BUG-02: Hint text inside mask pill, remove duplicate
- Move hint text inside the mask as a semi-transparent dark pill, bottom-aligned within the mask, white text
- Text: "Set number of images, position book, then Capture"
- Remove hint text currently displayed between camera view and CAPTURE button
- One message, one location

### BUG-03: CAPTURE button height
Increase CAPTURE button height to match wireframe proportions at docs/wireframes/changes-06-wireframe.png. All three primary buttons (CAPTURE, LOOKUP, SAVE) must be identical height throughout the workflow. As a side effect this reduces the camera view height, making it more square — this is intentional and desirable.

### FEAT-05: Controls bar treatment
- 1px border (#E5E5E5) around controls bar
- # dropdown and torch button slightly darkened — subtle background fill so they read as interactive controls against the #FAFAFA content zone
- Consistent with Metadata screen treatment

### FEAT-06: Dropdown extends to 0-5
- Extend photo count dropdown from 1-5 to 0-5
- Default remains 3 on first use, persists via localStorage
- When 0 selected:
  - □ indicators disappear from controls bar
  - CAPTURE button label changes to SKIP (same size, same blue color)
  - Changing dropdown back to 1+ immediately restores CAPTURE label and □ indicators

### FEAT-07: SKIP behavior
- Tapping SKIP advances to Metadata step
- Auto-checks "Review Photography?" on Review screen
- No photos stored in memory when SKIP is used

---

## Metadata Screen (camera mode)

### BUG-04: More pronounced landscape mask
Make the barcode target mask a more pronounced landscape rectangle — approximately 3:1 width:height ratio. Current mask is not wide enough relative to its height. Retain existing blue corner bracket indicators and semi-transparent overlay outside mask.

### BUG-05: Hint text inside mask pill, remove duplicate
- Move hint text inside the mask as a semi-transparent dark pill, bottom-aligned within the mask, white text
- Text: "Align barcode then tap Lookup, or use keyboard"
- Remove hint text currently displayed between camera view and LOOKUP button
- One message, one location

### BUG-06: LOOKUP button height
Increase LOOKUP button height to match wireframe proportions. Must be identical height to CAPTURE and SAVE buttons.

### FEAT-08: Controls bar treatment
- 1px border (#E5E5E5) around controls bar
- Keyboard and torch buttons slightly darkened — consistent with Photograph screen treatment

---

## Metadata Screen (keyboard mode)

### BUG-07: Keyboard-aware layout
When the iOS keyboard opens, the layout must shift upward so the LOOKUP button and Dashboard/Start Over buttons remain visible above the keyboard. Use the visualViewport resize event to detect keyboard open/close and adjust bottom padding accordingly. Everything must be visible simultaneously — user should never need to dismiss keyboard to tap LOOKUP.

### BUG-08: Step indicator and toolbar anchored at top
Step indicator and controls bar must remain anchored at the top of the screen when keyboard opens. They should never scroll off screen.

### BUG-09: Input field vertically centered
The ISBN input field should be vertically centered in the available space between the controls bar and the LOOKUP button, not floating near the bottom third of the screen.

### BUG-10: Lucide Camera icon
Replace current photo-realistic camera emoji/icon with Lucide Camera line art icon. Same styling as keyboard and torch buttons — slightly darkened background pill, consistent size and border radius.

### BUG-11: Replace field heading with placeholder text
- Remove "Enter ISBN-10 or ISBN-13" field heading entirely
- Replace existing placeholder text with: "Type ISBN-10 or ISBN-13, then tap Lookup"
- Style placeholder text slightly darker than standard gray for readability
- Placeholder disappears when user begins typing

### BUG-12: LOOKUP button height
Identical height to CAPTURE and SAVE buttons.

### FEAT-09: Controls bar treatment
- 1px border (#E5E5E5) around controls bar
- Camera button slightly darkened — consistent with other screens

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Examine docs/wireframes/changes-06-wireframe.png before planning
- Use Superpowers to decompose into small tasks
- Implement global items (FEAT-01 through FEAT-04) first before touching individual screens
- All three primary buttons (CAPTURE, LOOKUP, SAVE) must be identical height — implement as a shared style token
- Continue on existing worktree branch — do not merge to main under any circumstances
- Update CLAUDE.md at end of iteration including new Design Conventions section
- After deployment provide exact server commands
```
  git pull
  docker compose up -d --build
```
- No database migrations expected — flag immediately if any are needed
