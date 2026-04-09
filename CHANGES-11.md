# BookScan — Iteration 11 Change Document (FIXES + Dashboard Features)

## Context
This document combines outstanding visual/UX fixes from FIXES.md with two new dashboard features. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. All previous iterations (CHANGES-07 through CHANGES-10) should already be in place.

## Already Implemented (do not re-implement)
- ✓ FIX-06: Zone 2 height retained on Review screen when controls === null — confirmed fixed

---

## Global Fixes (implement first, in shared WorkflowWrapper)

### ✓ FIX-01: Primary buttons uniformly too short
Completed in CHANGES-10.

### ✓ FIX-02: Global color, button, and zone height system redesign
Completed in CHANGES-10.

### ✓ FIX-03: Toolbar icons are emoji, not Lucide line art
Completed in CHANGES-10.

### ✓ FIX-04/FIX-09: Header and toolbar scroll off screen on keyboard ISBN input screen
Completed in CHANGES-11. WorkflowWrapper outer container is `position: fixed` tracking `window.visualViewport.height` and `offsetTop` via event listeners. All zones use normal flex flow inside — no `position: fixed` on child zones.

### ✓ FIX-05: ISBN input placeholder text too wide for input box
Completed in CHANGES-10.

### ✓ FIX-07: Camera scan icon visible on desktop at narrow viewport widths
Completed in CHANGES-10.

### ✓ FIX-08: Black camera view occurring randomly on both camera screens
Completed in CHANGES-11. `sampleIsBlack()`, black frame check every 2s, 'ended' listener, `visibilitychange` listener, `restartRef` pattern for safe async handler access.

### ✓ FIX-10: Listing button field and content issues
All three sub-items completed in CHANGES-11:
- A: "TITLE:" → "LISTING TITLE:" in `generate_listing_text()`
- B: Description field in listing panel (shown when non-empty)
- C: Download Photos ZIP button in listing panel (shown when `has_photos`)

### ✓ FIX-11: Dashboard edit page photo display inconsistent with Review screen
Completed in CHANGES-11. `PhotoFilmstrip` extracted from `ReviewStep` and reused in `DashboardPage` edit view. `BookForm` gained `hideCover` prop to suppress duplicate cover (QA fix).

---

## Dashboard Features

### ✓ FEAT-01: Replace existing camera emoji with new status icons column
Completed in CHANGES-10.

### ✓ FEAT-02: Per-book photo ZIP download
Completed in CHANGES-10.

---

## Notes from Implementation
- Description (FIX-10B) rarely populated: sourced from Google Books only. OL fetcher never extracts description; OL Works endpoint not called. Many books have no description in Google Books. Future work: add OL Works API call as fallback.
- `position: fixed` on child zones does NOT work on iOS Safari with keyboard — see Key Decisions in CLAUDE.md for the correct visualViewport container approach.

---

## Status: COMPLETE ✓
All items in this document have been implemented and committed.
