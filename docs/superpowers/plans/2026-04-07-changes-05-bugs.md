# CHANGES-05 Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two wiring bugs in the photo workflow: audio not firing on any trigger point, and cancel buttons being overridden by in-flight API callbacks.

**Architecture:**
- BUG-05: The `useScanAudio` hook creates `AudioContext` lazily; when first called post-async-fetch, the browser creates a suspended context and tones never play. Also, the cleanup `ctx.close()` fires when `ReviewStep` unmounts (immediately after save triggers a step change), cutting off in-progress tones. Fix: resume suspended contexts before scheduling tones; delay close so tones can finish.
- BUG-06: `handleLookupComplete` in `PhotoWorkflowPage` has no guard against stale calls. User presses Cancel → step resets to `photograph` → but in-flight API call completes → callback calls `setStep('review')` overriding the cancel. Fix: track current step in a ref; skip stale callbacks.

**Tech Stack:** React 18, TypeScript, Web Audio API

---

### Task 1: Fix BUG-05 — AudioContext suspension and premature close

**Files:**
- Modify: `frontend/src/hooks/useScanAudio.ts`

Root causes:
1. `new AudioContext()` created after an `await` (e.g., after `lookupIsbn()` resolves) starts in `"suspended"` state per browser autoplay policy. Tones scheduled on a suspended context don't play.
2. `useScanAudio`'s `useEffect` cleanup calls `ctx.close()`. When `ReviewStep` saves and calls `onSaveComplete()`, the step changes to `photograph`, causing `ReviewStep` to unmount and the cleanup to fire — closing the `AudioContext` before the 0.2s tones finish.

Fix: In `playSuccess`/`playReview`, check `ctx.state === 'suspended'` and call `ctx.resume().then(schedule)` to schedule tones only after the context is running. Remove `ctx.close()` from cleanup (the context will be GC'd; tones finishing naturally is more important than explicit cleanup).

- [ ] **Step 1: Update `useScanAudio.ts`**

Replace the full file content:

```typescript
import { useRef, useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'

function getOrCreateCtx(ctxRef: MutableRefObject<AudioContext | null>): AudioContext {
  if (!ctxRef.current) {
    ctxRef.current = new AudioContext()
  }
  return ctxRef.current
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
): void {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = freq
  gainNode.gain.setValueAtTime(gain, startTime)
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function useScanAudio() {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    // No ctx.close() on cleanup: tones scheduled just before unmount (e.g., save sound)
    // need time to finish playing. The AudioContext will be garbage collected naturally.
    return () => {}
  }, [])

  // Ascending chime — data complete / save success
  const playSuccess = useCallback(() => {
    try {
      const ctx = getOrCreateCtx(ctxRef)
      const schedule = () => {
        const t = ctx.currentTime
        playTone(ctx, 880, t, 0.08, 0.4)
        playTone(ctx, 1108, t + 0.08, 0.12, 0.4)
      }
      if (ctx.state === 'suspended') {
        ctx.resume().then(schedule).catch(() => {})
      } else {
        schedule()
      }
    } catch {
      // Audio not available — silently ignore
    }
  }, [])

  // Descending tone — incomplete data / scan failure
  const playReview = useCallback(() => {
    try {
      const ctx = getOrCreateCtx(ctxRef)
      const schedule = () => {
        const t = ctx.currentTime
        playTone(ctx, 440, t, 0.15, 0.3)
        playTone(ctx, 330, t + 0.15, 0.10, 0.3)
      }
      if (ctx.state === 'suspended') {
        ctx.resume().then(schedule).catch(() => {})
      } else {
        schedule()
      }
    } catch {
      // Audio not available — silently ignore
    }
  }, [])

  return { playSuccess, playReview }
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 3: Verify all four audio trigger points exist in the codebase**

```bash
grep -n "playSuccess\|playReview" \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/pages/PhotoWorkflowPage.tsx \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/components/workflow/LookupStep.tsx \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/components/workflow/ReviewStep.tsx
```

Expected output must include:
- `PhotoWorkflowPage.tsx`: `playSuccess()` (successful lookup) and `playReview()` (incomplete metadata)
- `LookupStep.tsx`: `playReview()` (no barcode found) and `playReview()` (API error)
- `ReviewStep.tsx`: `playSuccess()` (successful save)

- [ ] **Step 4: Commit**

```bash
cd /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow && git add frontend/src/hooks/useScanAudio.ts && git commit -m "fix: resume suspended AudioContext before playing tones, remove premature close on unmount"
```

---

### Task 2: Fix BUG-06 — Cancel guard against in-flight lookup callbacks

**Files:**
- Modify: `frontend/src/pages/PhotoWorkflowPage.tsx`

Root cause: `handleLookupComplete` (a stable `useCallback`) unconditionally calls `setStep('review')`. If the user presses Cancel while a lookup API call is in-flight, the step resets to `photograph` — but when the API call resolves, `onLookupComplete` fires the stale callback and overrides the cancel by setting step back to `review`.

Fix: Add a `stepRef` that mirrors the current step value and is updated immediately on cancel (before the async re-render). Guard `handleLookupComplete` to bail out if `stepRef.current !== 'lookup'`.

- [ ] **Step 1: Update `PhotoWorkflowPage.tsx`**

Replace the full file content:

```typescript
import { useState, useCallback, useRef } from 'react'
import PhotographStep from '../components/workflow/PhotographStep'
import LookupStep from '../components/workflow/LookupStep'
import ReviewStep from '../components/workflow/ReviewStep'
import { useScanAudio } from '../hooks/useScanAudio'
import { BookLookup } from '../types'

type WorkflowStep = 'photograph' | 'lookup' | 'review'

export default function PhotoWorkflowPage() {
  const [step, setStep] = useState<WorkflowStep>('photograph')
  const [photos, setPhotos] = useState<File[]>([])
  const [targetCount, setTargetCount] = useState<number>(
    () => Number(localStorage.getItem('photoTargetCount') ?? 3)
  )
  const [lookupResult, setLookupResult] = useState<BookLookup | null>(null)
  const [savedBookId, setSavedBookId] = useState<string | null>(null)

  // Tracks current step immediately (before React re-renders) so handleLookupComplete
  // can detect stale calls caused by cancel being pressed while a lookup is in-flight.
  const stepRef = useRef<WorkflowStep>('photograph')

  const { playSuccess, playReview } = useScanAudio()

  function handlePhotoAdded(file: File) {
    setPhotos((prev) => {
      const next = [...prev, file]
      if (next.length >= targetCount) {
        stepRef.current = 'lookup'
        setStep('lookup')
      }
      return next
    })
  }

  function handleTargetCountChange(n: number) {
    setTargetCount(n)
    localStorage.setItem('photoTargetCount', String(n))
  }

  const handleLookupComplete = useCallback(
    (result: BookLookup) => {
      // Guard: if cancel was pressed while lookup was in-flight, stepRef is already
      // 'photograph'. Ignore the stale callback instead of overriding the cancel.
      if (stepRef.current !== 'lookup') return
      setLookupResult(result)
      setSavedBookId(null)
      if (result.data_complete) playSuccess()
      else playReview()
      stepRef.current = 'review'
      setStep('review')
    },
    [playSuccess, playReview]
  )

  function handleCancel() {
    // Update ref immediately so any in-flight lookup callback is ignored
    // even if it fires before the React re-render completes.
    stepRef.current = 'photograph'
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setStep('photograph')
  }

  function handleSaveComplete() {
    stepRef.current = 'photograph'
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setStep('photograph')
  }

  if (step === 'photograph') {
    return (
      <PhotographStep
        photos={photos}
        targetCount={targetCount}
        onTargetCountChange={handleTargetCountChange}
        onPhotoAdded={handlePhotoAdded}
        onCancel={handleCancel}
      />
    )
  }

  if (step === 'lookup') {
    return (
      <LookupStep
        onLookupComplete={handleLookupComplete}
        onCancel={handleCancel}
      />
    )
  }

  if (step === 'review' && lookupResult) {
    return (
      <ReviewStep
        lookupResult={lookupResult}
        photos={photos}
        savedBookId={savedBookId}
        onSavedBookId={setSavedBookId}
        onSaveComplete={handleSaveComplete}
        onCancel={handleCancel}
      />
    )
  }

  return null
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Verify cancel prop is wired in all three steps**

```bash
grep -n "onCancel" \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/pages/PhotoWorkflowPage.tsx \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/components/workflow/PhotographStep.tsx \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/components/workflow/LookupStep.tsx \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/components/workflow/ReviewStep.tsx \
  /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow/frontend/src/components/workflow/WorkflowWrapper.tsx
```

Expected: each file shows `onCancel` both received as prop and passed through to `WorkflowWrapper`.

- [ ] **Step 4: Commit**

```bash
cd /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow && git add frontend/src/pages/PhotoWorkflowPage.tsx && git commit -m "fix: guard handleLookupComplete with stepRef to prevent in-flight lookup overriding cancel"
```

---

### Task 3: Update CLAUDE.md

**Files:**
- Modify: `.worktrees/photo-workflow/CLAUDE.md` (the worktree copy)

- [ ] **Step 1: Add CHANGES-05 to Completed Iterations**

Find the `## Completed Iterations` section in CLAUDE.md and append after the CHANGES-04 block:

```markdown
**CHANGES-05** — both items fixed:
- BUG-05: Audio triggers reinstated — `useScanAudio` now resumes suspended `AudioContext` before scheduling tones (`ctx.resume().then(schedule)`), and removed premature `ctx.close()` from cleanup that was cutting off save-success tones before they finished playing
- BUG-06: Cancel guard added — `stepRef` in `PhotoWorkflowPage` tracks current step immediately; `handleLookupComplete` bails if `stepRef.current !== 'lookup'`, preventing in-flight lookup API responses from overriding a cancel press
```

- [ ] **Step 2: Commit CLAUDE.md**

```bash
cd /Users/eluhrs/claude/bookscan/.worktrees/photo-workflow && git add CLAUDE.md && git commit -m "docs: document CHANGES-05 audio and cancel fixes in CLAUDE.md"
```

---

## Manual Testing Checklist

After implementation, verify all eight trigger points manually on phone:

**BUG-05 — Audio (test on actual device or browser with Web Audio):**
- [ ] Press LOOKUP with barcode in view → lookup succeeds, metadata complete → ascending chime (880→1108 Hz)
- [ ] Press LOOKUP with barcode in view → lookup succeeds, metadata incomplete → descending tone (440→330 Hz)
- [ ] Press LOOKUP with no barcode in view (all strategies fail) → descending tone immediately
- [ ] Complete a review with condition selected, press SAVE → ascending chime plays (not cut off)

**BUG-06 — Cancel:**
- [ ] On Photograph screen with photos → press Cancel → photos cleared, stays on fresh Photograph screen
- [ ] On Lookup (camera mode) → press LOOKUP → immediately press Cancel before API responds → goes to Photograph screen and STAYS there (does not jump to Review)
- [ ] On Lookup (keyboard mode) → type ISBN, press LOOKUP → immediately press Cancel → stays on Photograph screen
- [ ] On Review screen → press Cancel → goes to fresh Photograph screen with no data retained
- [ ] On any screen → press Dashboard → navigates to /dashboard, all in-progress data discarded
