import { useState, useCallback } from 'react'
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

  const { playSuccess, playReview } = useScanAudio()

  function handlePhotoAdded(file: File) {
    setPhotos((prev) => {
      const next = [...prev, file]
      if (next.length >= targetCount) {
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
      setLookupResult(result)
      setSavedBookId(null)
      if (result.data_complete) playSuccess()
      else playReview()
      setStep('review')
    },
    [playSuccess, playReview]
  )

  function handleCancel() {
    setPhotos([])
    setLookupResult(null)
    setSavedBookId(null)
    setStep('photograph')
  }

  function handleSaveComplete() {
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
