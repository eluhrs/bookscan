import { useState, useCallback, useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import PhotographStep from '../components/workflow/PhotographStep'
import LookupStep from '../components/workflow/LookupStep'
import ReviewStep from '../components/workflow/ReviewStep'
import { useScanAudio } from '../hooks/useScanAudio'
import { generateSummary } from '../api/books'
import { BookLookup } from '../types'
import { theme } from '../styles/theme'

type WorkflowStep = 'photograph' | 'lookup' | 'review' | 'confirmation'

export type AiSummaryStatus = 'idle' | 'pending' | 'success' | 'failed'

export interface AiSummaryState {
  status: AiSummaryStatus
  text: string | null
}

const IDLE_AI: AiSummaryState = { status: 'idle', text: null }

export default function PhotoWorkflowPage() {
  const [step, setStep] = useState<WorkflowStep>('photograph')
  const [photos, setPhotos] = useState<File[]>([])
  const [targetCount, setTargetCount] = useState<number>(
    () => Number(localStorage.getItem('photoTargetCount') ?? 3)
  )
  const [lookupResult, setLookupResult] = useState<BookLookup | null>(null)
  const [savedBookId, setSavedBookId] = useState<string | null>(null)
  const [skippedPhotography, setSkippedPhotography] = useState(false)
  const [aiSummary, setAiSummary] = useState<AiSummaryState>(IDLE_AI)

  // Tracks current step immediately (before React re-renders) so handleLookupComplete
  // can detect stale calls caused by cancel being pressed while a lookup is in-flight.
  const stepRef = useRef<WorkflowStep>('photograph')
  // Generation token: lets us discard a stale Gemini response if the user cancelled
  // and started a new scan while the previous AI request was still in flight.
  const aiGenIdRef = useRef(0)

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
      setAiSummary(IDLE_AI)
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

      // Fire Gemini summary in parallel with entering Review step.
      // Skip if the lookup already returned a description (Google Books etc.) or
      // if the lookup failed badly enough that we have no usable metadata.
      if (result.description || !result.title) {
        setAiSummary(IDLE_AI)
        return
      }
      const myGen = ++aiGenIdRef.current
      setAiSummary({ status: 'pending', text: null })
      generateSummary({
        title: result.title,
        author: result.author,
        year: result.year,
        publisher: result.publisher,
      })
        .then((resp) => {
          if (myGen !== aiGenIdRef.current) return // stale — user cancelled / restarted
          if (resp.description) {
            setAiSummary({ status: 'success', text: resp.description })
          } else {
            setAiSummary({ status: 'failed', text: null })
          }
        })
        .catch(() => {
          if (myGen !== aiGenIdRef.current) return
          setAiSummary({ status: 'failed', text: null })
        })
    },
    [playSuccess, playReview]
  )

  function handleCancel() {
    // Update ref immediately so any in-flight lookup callback is ignored
    // even if it fires before the React re-render completes.
    stepRef.current = 'photograph'
    aiGenIdRef.current++ // invalidate any in-flight AI request
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setSkippedPhotography(false)
    setAiSummary(IDLE_AI)
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
        aiSummary={aiSummary}
      />
    )
  }

  return null
}
