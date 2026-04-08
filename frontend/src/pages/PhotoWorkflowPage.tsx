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
  const [skippedPhotography, setSkippedPhotography] = useState(false)

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
    setSkippedPhotography(false)
    setStep('photograph')
  }

  function handleSaveComplete() {
    stepRef.current = 'photograph'
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setSkippedPhotography(false)
    setStep('photograph')
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
