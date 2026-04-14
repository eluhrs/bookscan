# BookScan — Known Issues (FIXES.md)

This file tracks known issues discovered during testing that do not yet have a dedicated CHANGES document. When enough items accumulate, or when a natural checkpoint is reached, these will be compiled into a numbered CHANGES-XX.md for implementation.

---

## FIX-01: Primary buttons uniformly too short across all screens
CAPTURE, LOOKUP, and SAVE buttons are all shorter than the wireframe design specifies. This is a global issue affecting all three workflow screens. Button height should be increased uniformly — implement as a shared style token so all three buttons are identical height. Reference: docs/wireframes/changes-06-wireframe.png for correct proportions.

---

## FIX-02: Global color, button, and zone height system redesign
Multiple related visual issues that must be solved together as a unified design pass in the shared WorkflowWrapper component. Do not fix screen by screen.

**Issues to resolve:**

**A — Header/footer background too light:**
Current #F0F0F0 is insufficient contrast against #FAFAFA content zone. Needs a darker coordinating Geist-palette gray.

**B — Header and footer bars unequal height:**
Step indicator header and Dashboard/Start Over footer bar are different heights. Both should be equal height and anchored (position fixed or sticky) so they never scroll off screen regardless of content or keyboard state.

**C — Toolbar border reads as search bar:**
Current 1px border around the entire toolbar row looks like an input/search container rather than a controls bar. Remove the full-row border entirely. Replace with individual button styling — each button (#dropdown, keyboard, torch, camera) gets its own subtle background fill and 1px border. Buttons feel like distinct interactive controls, not a grouped row.

**D — Toolbar narrower than header:**
Toolbar row is narrower than the header zone above it, making it look like a floating element. Toolbar should be full width, consistent with header and footer zones.

**E — Three gray button types need visual hierarchy:**
Three distinct button types all appear gray and must be clearly distinguishable:
- Toolbar buttons: # dropdown, keyboard, torch, camera icons
- Footer buttons: Dashboard, Start Over
- SAVE button in disabled/unselected state

Recommended approach: Claude Code to propose a complete coordinating color system using the Geist palette for approval before implementing. Suggested starting point:
- Header/footer background: #E0E0E0 or darker
- Header/footer equal fixed height: Claude Code to propose appropriate value
- Toolbar buttons: individual styling, #FAFAFA background with 1px #CCCCCC border
- Footer buttons: slightly lighter than background with clear border
- SAVE disabled: #D0D0D0 with muted text

All changes implemented globally in WorkflowWrapper — not screen by screen.

---

## FIX-03: Toolbar icons are emoji, not Lucide line art
Keyboard and torch icons in the toolbar controls bar are currently emoji rather than Lucide React line art icons. Both must be replaced with Lucide equivalents:
- Keyboard icon: Lucide `Keyboard` component
- Torch icon: Lucide `Flashlight` or `Zap` component — Claude Code to choose best fit
- Camera icon (keyboard mode): Lucide `Camera` component — verify if already correct
All three icons must match in size, stroke width, and color. Styled consistently with individual button treatment from FIX-02.

---

## FIX-04: Header and toolbar scroll off screen on keyboard ISBN input screen
When the iOS keyboard opens on the Metadata keyboard input screen, the step indicator header and controls bar scroll off the top of the screen. Expected behavior: both must remain anchored at the top of the visible viewport at all times regardless of keyboard state.

Implementation note: use `position: fixed` or `position: sticky` for the header and controls bar zones, combined with the visualViewport resize event handler already implemented for the keyboard-aware layout. The equal-height fixed header from FIX-02B should address this naturally — verify after FIX-02 is implemented.

Believed to be isolated to the keyboard ISBN input screen only — camera screens appear unaffected. Verify this assumption during implementation and fix any other screens exhibiting the same behavior.

---

## FIX-05: ISBN input placeholder text too wide for input box
The placeholder text in the ISBN input field on the keyboard mode screen is too long to fit the input box width at current font size. Fix: reduce font size of the placeholder text just enough to fit the full text within the input box width without truncation or scrolling. Do not change placeholder font size on other screens — Capture and Lookup hint text is already correctly sized.

Current placeholder text: "Type ISBN-10 or ISBN-13, then tap Lookup"

---

## Notes for Claude Code
When this file is referenced in a CHANGES document:
- Treat each FIX as a discrete task
- FIX-02 is the most complex — propose the complete color/sizing system for approval before implementing
- FIX-01 and FIX-02 are global — implement in shared WorkflowWrapper before touching individual screens
- FIX-02B (equal height anchored bars) may naturally resolve FIX-04 — verify after FIX-02 is complete before implementing FIX-04 separately
- FIX-03 can be done screen by screen but verify all icons are consistent when complete
- FIX-05 is a single CSS change — lowest risk, do last
