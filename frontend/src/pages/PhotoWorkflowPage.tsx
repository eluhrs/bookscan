import { useState, useCallback, useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import PhotographStep from '../components/workflow/PhotographStep'
import LookupStep from '../components/workflow/LookupStep'
import ReviewStep from '../components/workflow/ReviewStep'
import { useScanAudio } from '../hooks/useScanAudio'
import { BookLookup } from '../types'
import { theme } from '../styles/theme'

type WorkflowStep = 'photograph' | 'lookup' | 'review' | 'confirmation'

export default function PhotoWorkflowPage() {
  const [step, setStep] = useState<WorkflowStep>('photograph')
  const [photos, setPhotos] = useState<File[]>([])
  const [targetCount, setTargetCount] = useState<number>(
    () => Number(localStorage.getItem('photoTargetCount') ?? 3)
  )
  const [lookupResult, setLookupResult] = useState<BookLookup | null>(null)
  const [savedBookId, setSavedBookId] = useState<string | null>(null)
  const [skippedPhotography, setSkippedPhotography] = useState(false)

  // Tracks current step immediately (before React re-renders) so handleLookupComplete
  // can detect stale calls caused by cancel being pressed while a lookup is in-flight.
  const stepRef = useRef<WorkflowStep>('photograph')

  const { playSuccess, playReview } = useScanAudio()

  // Confirmation overlay: fires playSuccess + haptic, then resets state after 800ms
  useEffect(() => {
    if (step !== 'confirmation') return
    playSuccess()
    navigator.vibrate?.(25)
    const t = setTimeout(() => {
      setPhotos([])
      setLookupResult(null)
      setSavedBookId(null)
      setSkippedPhotography(false)
      setStep('photograph')
    }, 800)
    return () => clearTimeout(t)
  }, [step, playSuccess])

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

  function handleSkip() {
    setSkippedPhotography(true)
    stepRef.current = 'lookup'
    setStep('lookup')
  }

  const handleLookupComplete = useCallback(
    (result: BookLookup) => {
      // Guard: if cancel was pressed while lookup was in-flight, stepRef is already
      // 'photograph'. Ignore the stale callback instead of overriding the cancel.
      if (stepRef.current !== 'lookup') return
      setLookupResult(result)
      setSavedBookId(null)
      if (!result.needs_metadata_review) playSuccess()
      else playReview()
      navigator.vibrate?.(25)
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
    setSkippedPhotography(false)
    setStep('photograph')
  }

  function handleSaveComplete() {
    stepRef.current = 'photograph'
    setStep('confirmation')
    // State reset (photos, lookupResult, etc.) happens in the useEffect after 800ms
  }

  if (step === 'confirmation') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={80} color={theme.colors.accent} strokeWidth={2.5} />
      </div>
    )
  }

  if (step === 'photograph') {
    return (
      <PhotographStep
        photos={photos}
        targetCount={targetCount}
        onTargetCountChange={handleTargetCountChange}
        onPhotoAdded={handlePhotoAdded}
        onSkip={handleSkip}
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
        skippedPhotography={skippedPhotography}
      />
    )
  }

  return null
}
