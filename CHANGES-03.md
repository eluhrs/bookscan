# BookScan — Iteration 3 Change Document

## Context
This document describes bug fixes for the second post-launch iteration. Claude Code should begin by reading CLAUDE.md, SPEC.md, and this file, then explore the codebase to understand the current implementation before planning any changes.

---

## 1. Bug Fixes

### BUG-01: CSV export produces empty file (headers only, no data rows)
The global CSV export on the dashboard generates a file with correct headers but no data rows. The export function is not retrieving or serializing the actual book records. Investigate the export endpoint and frontend fetch logic, identify why records are not being included, and fix.

### BUG-02: Delete non-functional for records created before version 2
Records created prior to this version cannot be deleted via the dashboard delete button. A table truncation was used as a workaround. The delete endpoint or frontend logic is likely making an assumption about record structure or IDs that is not valid for older records. Fix the delete function to work reliably regardless of when the record was created, and add a safeguard to ensure future version updates do not break delete functionality.

### BUG-03: Double confirmation modal on delete
When deleting newly created records, two confirmation modals appear sequentially. There should be zero confirmation modals — remove both. Delete should execute immediately on button press.

### BUG-04: Negative sound not triggering correctly
The negative sound plays when a lookup returns incomplete data, but does not play when the scan attempt fails entirely ("No barcode found — try again"). The negative sound should trigger in both cases:
- Barcode detected but metadata lookup returns incomplete data
- No barcode detected in the captured frame ("No barcode found")

Audit all scan failure and partial-success paths and ensure the negative sound is consistently triggered across all of them.

---

## 2. Data Enhancement

### DATA-01: Dimensions and weight from metadata sources
Books scanned with the current implementation do not return dimensions or weight. These fields are important for calculating shipping costs when creating eBay listings. Investigate whether this is a data availability issue (the current sources don't carry physical specs for most titles) or an implementation issue (the fields exist in source APIs but are not being requested or mapped). 

- If it is an implementation issue: fix the lookup logic to retrieve and store these fields
- If it is a data availability issue: document which sources carry physical specs, what coverage looks like for academic titles, and make a recommendation for whether adding ISBNdb (paid, ~$10/mo) is justified for this use case. Add a note to CLAUDE.md summarizing the findings.

---

## 3. Scanning Improvements (Critical)

### SCAN-01: Camera scanning reliability overhaul
Scanning success rate is very low across devices. The only consistently scannable books have larger-than-average barcodes. Key constraints:

- The app will be used across multiple phones with varying camera quality
- The iPhone Air (no macro lens) requires more distance to focus, making small barcodes harder to capture
- Must work reasonably well across a range of devices, not just high-end cameras

Claude Code should treat this as an open research and implementation task:

1. **Audit the current scanning implementation** — review the library in use, camera API configuration, resolution settings, focus mode, and scan rectangle crop logic
2. **Research and implement camera improvements** using available browser APIs, which may include:
   - Requesting higher camera resolution for better barcode detail
   - Enabling continuous auto-focus or tap-to-focus via the MediaStream API
   - Torch/flashlight activation if available (helps with focus on many devices)
   - Adjusting the crop region sent to the decoder for better signal-to-noise ratio
   - Digital zoom on the crop region to compensate for distance
   - Trying multiple decode attempts at different crop sizes or zoom levels per button press
3. **Evaluate whether the current scanning library is the bottleneck** — if camera API improvements alone are insufficient, evaluate alternative libraries and recommend/implement the best option. Document the decision in CLAUDE.md.
4. **Test considerations** — document what was tried and what impact each change had, so future iterations can build on this work rather than repeat it

The goal is reliable scanning across a range of phone cameras, not just high-end devices. If after exhausting camera improvements the success rate is still poor, note this clearly so the USB/Bluetooth scanner fallback can be prioritized in the next iteration.

---

## Notes for Claude Code
- Fix bugs first, then data enhancement, then scanning
- BUG-02 is particularly important — ensure the fix is robust and not version-dependent
- SCAN-01 is the highest impact item in this iteration — give it appropriate time and research effort
- Update CLAUDE.md at the end of this iteration to reflect all changes, findings, and any deferred decisions
- After each deployable milestone provide exact server-side commands:
  ```
  git pull
  docker compose up -d --build
  ```
- Call out any database migrations explicitly with exact commands
