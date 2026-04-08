# BookScan CHANGES-07 Design Spec
_Date: 2026-04-07_

Wireframe alignment pass for the Photograph and Metadata screens, plus global design convention fixes across all workflow screens. One new database field and migration.

---

## Scope

- Branch: master (no feature branch)
- Migration required: Yes — migration 004 (`needs_photo_review` column)
- Files touched: WorkflowWrapper, PhotographStep, LookupStep, ReviewStep, PhotoWorkflowPage, backend models/schemas/migration

---

## Global Changes (WorkflowWrapper)

### FEAT-01: Button case convention
Button labels are already ALL CAPS (CAPTURE, LOOKUP, SAVE). One hint text fix needed: PhotographStep currently passes `"Set number of images, position book, then capture"` — "capture" must be capitalized to "Capture". All other hint text references to buttons already use Title Case.

### FEAT-02: Step indicator zone background
Add `background: '#F0F0F0'` to the step indicator zone (Zone 1) in WorkflowWrapper.

### FEAT-03: Lower button bar background
Add `background: '#F0F0F0'` to the secondary buttons zone (Zone 6 — Dashboard / Start Over) in WorkflowWrapper. Apply as a wrapper div background, not individual button backgrounds.

### FEAT-04: "Cancel" renamed "Start Over"
Change button label in WorkflowWrapper Zone 6 from "Cancel" to "Start Over". Behavior is unchanged — calls `onCancel`.

### Shared primary button height token
WorkflowWrapper's primary button (Zone 5) gets an explicit `minHeight: 56px` applied consistently. All three primary buttons (CAPTURE, LOOKUP, SAVE) render via WorkflowWrapper and therefore share this height automatically. This makes the primary button visibly larger than the secondary strip (~40px), matching wireframe proportions.

---

## Photograph Screen (PhotographStep)

### BUG-01: Square mask
Replace the current 3:4 portrait rectangle mask with the largest square that fits within the camera view container. CSS cannot express `min(containerWidth, containerHeight)` in this flex context, so the side length must be computed in JS: use a `ResizeObserver` on the camera container element (or `useLayoutEffect` + `getBoundingClientRect`) to track container dimensions, store `squareSide = Math.min(containerWidth, containerHeight)` in state, and apply it as explicit `width` and `height` on the mask div. Subtract a small padding (e.g. 24px) on each axis so the square doesn't touch the edges. The box-shadow cutout and corner brackets remain; only the aspect ratio changes.

### BUG-02: Hint text inside mask only
- Text: `"Set number of images, position book, then Capture"` (Title Case on "Capture")
- Rendered as a semi-transparent dark pill, bottom-aligned inside the mask, white text
- Remove the `hintText` prop being passed to WorkflowWrapper — Zone 4 should not render for PhotographStep

### BUG-03: CAPTURE button height
Inherits from shared WorkflowWrapper token — no PhotographStep-specific change needed beyond removing any overrides.

### FEAT-05: Controls bar treatment
- Add `border: '1px solid #E5E5E5'` around the controls bar zone (Zone 2)
- `#` dropdown: add a subtle background fill (e.g. `background: theme.colors.subtle`) so it reads as an interactive control
- Torch button: already has `background: theme.colors.subtle` when off — no change needed

### FEAT-06: Dropdown extends to 0–5
- Change dropdown options from `[1,2,3,4,5]` to `[0,1,2,3,4,5]`
- When `targetCount === 0`: progress indicators (`□/■`) hidden from controls bar
- When `targetCount === 0`: primary button label changes from `"CAPTURE"` to `"SKIP"`
- Default remains 3 (localStorage); if stored value is 0, SKIP is shown immediately on mount

### FEAT-07: SKIP behavior
- When primary button is tapped with `targetCount === 0`, call a new `onSkip` handler instead of `handleCapture`
- `onSkip` advances to the Lookup step
- `PhotoWorkflowPage` tracks a new `skippedPhotography: boolean` state (default `false`)
- `skippedPhotography` is set `true` when SKIP is used, reset to `false` on `handleCancel` / `handleSaveComplete`
- `skippedPhotography` is passed to `ReviewStep` so it can auto-check "Review Photography?"

---

## Metadata Screen — Camera Mode (LookupStep)

### BUG-04: More pronounced landscape mask
Change mask dimensions to approximately 3:1 width:height ratio. Suggested values: `left: '5%', right: '5%', top: '32%', bottom: '32%'`. Retain blue corner brackets and semi-transparent overlay outside mask.

### BUG-05: Hint text inside mask only
- Text: `"Align barcode then tap Lookup, or use keyboard"` (already Title Case)
- Rendered as semi-transparent dark pill, bottom-aligned inside the mask, white text
- Remove `hintText` prop from WorkflowWrapper in camera mode (error messages remain — see below)

Note on error messages: `hintError` currently surfaces via the `hintText` prop. With hintText removed from camera mode, errors should instead render inside the camera view or below the mask. Suggested: keep `hintText` prop only for error state in camera mode (non-null `hintError`). When no error, pass `undefined`.

### BUG-06: LOOKUP button height
Inherits from shared WorkflowWrapper token automatically.

### FEAT-08: Controls bar treatment
- Add `border: '1px solid #E5E5E5'` around the controls bar zone (Zone 2)
- Keyboard button (`⌨`): add `background: theme.colors.subtle`
- Torch button: already has subtle background when off — no change needed

---

## Metadata Screen — Keyboard Mode (LookupStep)

### BUG-07/08/09: Keyboard-aware layout
When the iOS software keyboard opens, the visible viewport shrinks. Use the `visualViewport` API to detect this and adjust the layout.

Implementation approach:
- `LookupStep` adds a `useEffect` that listens to `window.visualViewport?.addEventListener('resize', handler)`
- Handler computes `keyboardHeight = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight)`
- Store `keyboardHeight` in component state
- In keyboard mode, the bottom buttons zone uses `paddingBottom: keyboardHeight` (or equivalent) so they float above the keyboard
- Step indicator and controls bar stay anchored at top — no change needed since they are `flexShrink: 0` at the top of the flex column
- The content zone (input field) fills remaining space and uses `justifyContent: 'center'` to vertically center the input — this already works naturally as the zone shrinks

The key layout change: `LookupStep` tracks `viewportHeight` in state, initialized to `window.visualViewport?.height ?? window.innerHeight`. The `visualViewport` resize handler updates this value. `LookupStep` passes `viewportHeight` to WorkflowWrapper via a new optional `viewportHeight` prop. WorkflowWrapper uses it as `height: viewportHeight` on the root container (overriding `100dvh`) only when keyboard mode is active. This causes all flex children to reflow naturally within the visible area — no fixed positioning needed.

Cleanup: `removeEventListener` on effect teardown. WorkflowWrapper uses `100dvh` when `viewportHeight` is undefined (all other screens unaffected).

### BUG-10: Lucide Camera icon
Replace `📷` emoji with Lucide `<Camera />` icon. Style identically to the keyboard button: same padding, border, borderRadius, background. Lucide is already available as `lucide-react` (check package.json; add if missing).

### BUG-11: Replace field heading with placeholder text
- Remove the `<label>` element ("Enter ISBN-10 or ISBN-13")
- Set input placeholder to `"Type ISBN-10 or ISBN-13, then tap Lookup"`
- Style placeholder slightly darker than default: inject a `<style>` element in the keyboard mode JSX with a unique class selector, e.g. `.isbn-input::placeholder { color: #6B7280; }`. The project uses inline styles throughout and has no CSS files, so a scoped `<style>` tag is the correct approach here.

### BUG-12: LOOKUP button height
Inherits from shared WorkflowWrapper token automatically.

### FEAT-09: Controls bar treatment
- Add `border: '1px solid #E5E5E5'` around the controls bar zone (Zone 2)
- Camera button: add `background: theme.colors.subtle`

---

## Review Screen (ReviewStep)

### Label rename
"Mark for Review?" → **"Review Metadata?"**. Behavior unchanged: checked state sets `data_complete = false` on save.

### New "Review Photography?" checkbox
- Add a second checkbox below "Review Metadata?"
- Label: `"Review Photography?"`
- `defaultChecked` is `true` when `skippedPhotography` prop is `true`, otherwise `false`
- State managed locally with `useState`
- Value saved as `needs_photo_review` on book creation

### Props change
`ReviewStep` receives a new `skippedPhotography: boolean` prop from `PhotoWorkflowPage`.

### Save payload
`handleSave` includes `needs_photo_review: needsPhotoReview` (local state) in the `saveBook()` call.

---

## Backend Changes

### Migration 004
New Alembic migration: `004_add_needs_photo_review.py`
```python
op.add_column('books', sa.Column('needs_photo_review', sa.Boolean(), nullable=False, server_default=sa.false()))
```

### Model
Add `needs_photo_review: bool = False` to the `Book` ORM model.

### Schemas
- `BookCreate`: add `needs_photo_review: bool = False`
- `BookUpdate`: add `needs_photo_review: Optional[bool] = None`
- `BookResponse`: add `needs_photo_review: bool`

### Router
`books.py` `POST /api/books`: already maps `BookCreate` fields to `Book` model — no router change needed if schema field is added.

---

## Design Conventions (to add to CLAUDE.md)

New section to document:
- Primary action buttons: ALL CAPS (CAPTURE, LOOKUP, SAVE, SKIP)
- Hint text references to buttons: Title Case ("tap Lookup", "tap Capture")
- Primary button height: shared via WorkflowWrapper — do not override per-step
- Controls bar styling: 1px `#E5E5E5` border, interactive controls get `theme.colors.subtle` background fill
- Step indicator zone: `#F0F0F0` background
- Secondary button bar zone: `#F0F0F0` background

---

## Files Changed

| File | Change |
|---|---|
| `WorkflowWrapper.tsx` | FEAT-02/03/04, shared button height, optional `keyboardOffset` prop |
| `PhotographStep.tsx` | BUG-01/02/03, FEAT-05/06/07 |
| `LookupStep.tsx` | BUG-04/05/06/07/08/09/10/11/12, FEAT-08/09 |
| `ReviewStep.tsx` | Label rename, new checkbox, `skippedPhotography` prop, save payload |
| `PhotoWorkflowPage.tsx` | `skippedPhotography` state, `onSkip` handler, pass prop to ReviewStep |
| `api/models.py` | `needs_photo_review` column |
| `api/schemas.py` | `needs_photo_review` in BookCreate/Update/Response |
| `api/alembic/versions/004_add_needs_photo_review.py` | New migration |
| `CLAUDE.md` | Design Conventions section + CHANGES-07 completion summary |

---

## Out of Scope

- Dashboard display/filtering of `needs_photo_review` (future CHANGES file)
- Barcode decode logic changes
- useCameraStream hook internals
- Any routes beyond schema field propagation
