# BookScan — Iteration 6 Change Document

> **Status: COMPLETE** — All items implemented. Branch: `feat/photo-workflow`. Awaiting merge to main after manual testing.

## Context
This document describes a comprehensive redesign of the photo workflow UI, replacing the current implementation with a live camera view for both photography and barcode lookup, consistent light backgrounds throughout, and refined controls. Claude Code should read CLAUDE.md, SPEC.md, and this file, examine the wireframe image, then use Superpowers to plan before writing any code. Continue working on the existing worktree branch and do not merge to main under any circumstances.

## Wireframe Reference
See: docs/wireframes/changes-06-wireframe.png

Legend:
- # = Photo count dropdown
- T = Torch button
- K = Keyboard button (switch to manual ISBN entry)
- C = Camera button (switch back to camera from keyboard)

---

## Pre-existing Bugs to Confirm

### BUG-01: Verify Cancel buttons remain functional
✅ Confirmed — all Cancel paths work after redesign.

### BUG-02: Verify audio feedback remains functional
✅ Confirmed — all 5 audio trigger points work after redesign.

---

## Design System
All screens in the workflow use these values consistently:

- Background: #FAFAFA (Geist off-white) on ALL screens including camera screens
- Primary button: #0070F3 (Vercel blue), large, full-width, rounded corners, white text
- Primary text: Claude Code to choose within Geist palette — near-black or dark gray, consistent throughout
- Secondary actions: Dashboard and Cancel as small equal-width rounded buttons below primary button, light background, dark text
- Step indicator: small centered text with ○ (upcoming/completed) and ● (current step) markers
- Camera view: live video feed inside a rounded rectangle with a subtle 1px light gray border (#E5E5E5)
- Controls bar: sits between step indicator and camera view, contains screen-specific icon buttons

---

## Consistent Screen Structure
Every screen follows this zone layout top to bottom:
1. Phone status bar
2. Step indicator — centered, example: ● Photograph · ○ Metadata · ○ Review
3. Controls bar — screen-specific icon buttons
4. Main content area — live camera view or form content
5. Hint text — below main content area, centered, small gray text
6. Primary button — large, blue (#0070F3), full width
7. Secondary buttons — Dashboard (left) and Cancel (right), small, equal width, side by side
8. Browser controls

Implement as a shared WorkflowWrapper component so all screens inherit this structure automatically.

---

## Screen Specifications

### Screen 1 — Photograph Step ✅

**Step indicator:** ● Photograph · ○ Metadata · ○ Review

**Controls bar:**
- Left: # = photo count dropdown, options 1-5, defaults to 3, persists via localStorage
- Center: photo progress indicators — one square per selected count, fills additively as photos are taken. Unfilled = □, filled = ■. Example with 2 of 3 taken: ■ ■ □
- Right: T = torch toggle button

**Main content area:**
- Live camera view, full width, rounded rectangle, 1px #E5E5E5 border
- Portrait orientation target mask overlaid on camera feed — taller than wide, approximately 3:4 ratio, centered, semi-transparent dark overlay outside mask area, blue corner bracket indicators
- Hint text overlaid inside camera view, bottom-aligned within mask, semi-transparent dark pill background, white text, dynamic per photo number:
  - Photo 1: "Position front cover"
  - Photo 2: "Position back cover"
  - Photo 3: "Position spine"
  - Photo 4+: "Position additional view"

**Hint text below camera view:** "Set number of images, position book, then capture"

**Primary button:** CAPTURE ✅
**Secondary buttons:** Dashboard | Cancel ✅

---

### Screen 2 — Metadata Step (camera mode) ✅

**Step indicator:** ○ Photograph · ● Metadata · ○ Review

**Controls bar:**
- Left: K = keyboard button
- Right: T = torch toggle button

**Main content area:**
- Live camera view, full width, rounded rectangle, 1px border
- Landscape orientation target mask, blue corner bracket indicators
- Hint text overlaid inside camera view: "Align barcode within frame"

**Hint text below camera view:** "Align barcode then tap Lookup, or use keyboard"

**Primary button:** LOOKUP ✅
**Secondary buttons:** Dashboard | Cancel ✅

---

### Screen 3 — Metadata Step (keyboard mode) ✅

**Step indicator:** ○ Photograph · ● Metadata · ○ Review

**Controls bar:**
- Left: C = camera button

**Main content area:**
- Label: "Enter ISBN-10 or ISBN-13"
- Centered text input, rounded border, numeric keyboard on focus

**Hint text below input:** "Type ISBN and tap Lookup"

**Primary button:** LOOKUP ✅
**Secondary buttons:** Dashboard | Cancel ✅

---

### Screen 4 — Review Step ✅

**Step indicator:** ○ Photograph · ○ Metadata · ● Review

**Controls bar:** empty

**Main content area:**
- Cover thumbnail: 2:3 portrait aspect ratio, rounded corners, left-aligned
- Metadata text right of thumbnail: title bold, author, year · publisher
- Condition selector: New · Very Good · Good · Acceptable · Poor, selected = blue
- Mark for Review? checkbox, auto-checked if incomplete metadata

**Primary button:** SAVE (disabled until condition selected) ✅
**Secondary buttons:** Dashboard | Cancel ✅

---

## Technical Implementation Notes — All Implemented ✅

### Live Camera Capture (Photograph Step)
- useCameraStream hook shared with Metadata step
- Frame capture: canvas snapshot → max 1200px → 85% JPEG → File object
- Camera reinitializes cleanly on return to Photograph step

### Target Masks ✅
- Photograph step: portrait mask (left:15%, right:15%, top:5%, bottom:5%)
- Metadata step: landscape mask (left:10%, right:10%, top:25%, bottom:25%)
- Both masks: semi-transparent dark overlay, blue corner bracket indicators

### Photo Progress Indicators ✅
- □/■ per selected count, fills left to right, resets on fresh screen

### Audio — All Five Trigger Points ✅
- Photograph step: capture → positive
- Metadata step: lookup success (complete) → positive
- Metadata step: lookup fail / incomplete → negative
- Review step: save → positive

### New Architecture ✅
- `useCameraStream` hook: shared camera setup, torch, persistedTorchOn, cancelled-flag race guard
- `WorkflowWrapper` hintText prop: optional hint text zone above primary button
- Theme tokens added: subtle, subtleText, disabled, disabledText

---

## What Was Not Changed
- Barcode decode library and logic ✅ retained verbatim
- Backend API endpoints ✅ no changes
- Database schema ✅ no changes
- Desktop dashboard ✅ no changes
- Sound generation ✅ rewired only

---

## Notes
- No database migrations needed
- No backend changes
- Branch: `feat/photo-workflow` — do not merge to main until manual testing complete
