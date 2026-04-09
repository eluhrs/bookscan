# BookScan — Iteration 10 Change Document (FIXES + Dashboard Features)

## Status: COMPLETE
All items implemented and committed. Frontend tests updated to match new implementation. No database migrations required.

## Context
This document combines outstanding visual/UX fixes from FIXES.md with two new dashboard features. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. All previous iterations (CHANGES-07 through CHANGES-09) should already be in place.

## Already Implemented (do not re-implement)
- FIX-06: Zone 2 height retained on Review screen when controls === null — confirmed fixed

---

## Global Fixes (implement first, in shared WorkflowWrapper)

### FIX-01: Primary buttons uniformly too short
CAPTURE, LOOKUP, and SAVE buttons are all shorter than the wireframe design specifies. Increase button height uniformly — implement as a shared style token so all three buttons are identical height across all workflow screens. Reference: docs/wireframes/changes-06-wireframe.png for correct proportions.

### FIX-02: Global color, button, and zone height system redesign
Multiple related visual issues that must be solved together as a unified design pass in the shared WorkflowWrapper component. Do not fix screen by screen.

**A — Header/footer background too light:**
Current #F0F0F0 is insufficient contrast against #FAFAFA content zone. Claude Code to propose a complete coordinating Geist-palette color system for all zones and button types before implementing. Suggested starting point:
- Header/footer background: #E0E0E0 or darker
- Toolbar buttons: individual styling, #FAFAFA background with 1px #CCCCCC border
- Footer buttons: slightly lighter than background with clear border
- SAVE disabled state: #D0D0D0 with muted text

**B — Header and footer bars unequal height:**
Step indicator header and Dashboard/Start Over footer bar are different heights. Both should be equal height and anchored (position fixed or sticky) so they never scroll off screen regardless of content or keyboard state.

**C — Toolbar border reads as search bar:**
Remove the full-width 1px border around the entire toolbar row. Replace with individual button styling — each button (#dropdown, keyboard, torch, camera) gets its own subtle background fill and 1px border. Buttons feel like distinct interactive controls, not a grouped container.

**D — Toolbar narrower than header:**
Toolbar row should be full width, consistent with header and footer zones.

**E — Three gray button types need visual hierarchy:**
Three distinct button types all appear gray and must be clearly distinguishable:
- Toolbar buttons: # dropdown, keyboard, torch, camera icons
- Footer buttons: Dashboard, Start Over
- SAVE button in disabled/unselected state

Claude Code must propose the complete color system for all five sub-items above before writing any code. Present the proposal clearly so it can be reviewed and approved before implementation.

---

## Screen-Specific Fixes (implement after global fixes)

### FIX-03: Toolbar icons are emoji, not Lucide line art
Replace emoji icons with Lucide React line art throughout:
- Keyboard icon: Lucide `Keyboard` component
- Torch icon: Lucide `Flashlight` or `Zap` — Claude Code to choose best fit
- Camera icon (keyboard mode): Lucide `Camera` — verify if already correct
All three icons must match in size, stroke width, and color. Style consistently with individual button treatment from FIX-02C.

### FIX-04: Header and toolbar scroll off screen on keyboard ISBN input screen
When iOS keyboard opens on the Metadata keyboard input screen, step indicator header and controls bar scroll off the top of the screen. Fix: use position fixed or sticky for both zones combined with the existing visualViewport resize event handler. The equal-height fixed header from FIX-02B may naturally resolve this — verify after FIX-02 is implemented before fixing separately.

Verify fix on keyboard ISBN screen only — camera screens believed unaffected. Confirm assumption during implementation.

### FIX-05: ISBN input placeholder text too wide for input box
Placeholder text "Type ISBN-10 or ISBN-13, then tap Lookup" is too long to fit the input box at current font size. Fix: reduce placeholder font size just enough to fit fully within the input box width. Do not change placeholder font size on other screens.

### FIX-07: Camera scan icon visible on desktop at narrow viewport widths
The mobile-only camera scan icon on /dashboard is currently shown based on viewport width (<768px), incorrectly displaying on resized desktop browsers. Fix: replace viewport width detection with user agent based device detection. Camera icon should only appear on genuine mobile devices regardless of window size.

Implementation: use navigator.userAgent combined with navigator.maxTouchPoints > 0 for reliable detection. Implement as a reusable isMobileDevice() utility function.

---

## CLAUDE.md Updates Required

### Haptic feedback iOS limitation
Add to known limitations section:
"Haptic feedback via Web Vibration API is not supported on iOS/Safari or any iOS browser — this is an Apple platform restriction at the WebKit level with no available workaround. Chrome, Firefox, and all other browsers on iOS are also affected. Android Chrome supports haptics fully. The haptic code is intentionally retained to benefit Android users."

### Design conventions
Confirm the following are documented under Design Conventions in CLAUDE.md:
- Primary action buttons: ALL CAPS labels
- Hint text references to buttons: Title Case
- Background zones: #FAFAFA content, header/footer per FIX-02 color system
- Lucide line art icons throughout — no emoji

---

## Dashboard Features

### FEAT-01: Replace existing camera emoji with new status icons column
The dashboard inventory table currently displays a camera emoji next to the title when photos exist. This is the inverse of the intended behavior and must be removed.

**Remove:**
- Existing camera emoji from the title column

**Add:**
- New untitled icon column to the left of the title column
- Two fixed-width slots, always the same width regardless of content
- No column header — leave blank

**Slot 1 — Metadata status (left slot):**
- Icon: Lucide `FileWarning`
- Color: amber
- Visible when: `needs_metadata_review` is true
- Hidden (empty slot) when false

**Slot 2 — Photography status (right slot):**
- Icon: Lucide `Camera`
- Color: #0070F3
- Visible when: `needs_photo_review` is true
- Hidden (empty slot) when false

**Fixed two-slot alignment:**
```
[m][ ]   metadata only
[ ][p]   photography only
[m][p]   both
[ ][ ]   neither — empty slots, no icons shown
```

**Icon styling:**
- Lucide line art, same size, consistent stroke width
- Amber for FileWarning, #0070F3 for Camera
- Monochrome Geist-consistent style
- No column header

### FEAT-02: Per-book photo ZIP download
Add a download button to each book detail/edit view on the dashboard:
- Button label: "Download Photos"
- Disabled with tooltip "No photos to download" if no user photos exist
- ZIP filename: {isbn}_{title_slug}.zip — e.g. 9780743273565_the_bauhaus_group.zip
- ZIP contents: user-taken photos only in capture order, named photo_1.jpg, photo_2.jpg etc
- Cover image from lookup NOT included
- New backend endpoint: GET /books/{book_id}/photos/download — streams ZIP to browser using Python standard library zipfile — no new dependencies needed
- No database changes required

---

## Implementation Order
1. FIX-02 — propose color system for approval before implementing
2. FIX-01 — implement after FIX-02 color system approved
3. FIX-03 — implement after FIX-02, verify all icons consistent
4. FIX-04 — verify if resolved by FIX-02B before implementing separately
5. FIX-05 — single CSS change, implement anytime
6. FIX-07 — implement after global fixes complete
7. FEAT-01 — dashboard only, independent of workflow fixes
8. FEAT-02 — dashboard only, implement after FEAT-01

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- FIX-02 requires proposing a color system for approval before writing any code — do not skip this step
- FIX-04 may be resolved by FIX-02B — verify before treating as separate task
- FEAT-02 uses Python standard library zipfile — no new pip dependencies needed
- Update CLAUDE.md at end of iteration including haptic limitation note and design conventions
- After deployment provide exact server commands:
```
  git pull
  docker compose up -d --build
```
- No database migrations expected — flag immediately if any are needed
