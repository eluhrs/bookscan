// frontend/src/components/workflow/ReviewStep.tsx

import { useState, useEffect } from 'react'
import WorkflowWrapper from './WorkflowWrapper'
import { BookLookup } from '../../types'
import { saveBook } from '../../api/books'
import { uploadPhotos } from '../../api/photos'
import { theme } from '../../styles/theme'
import PhotoFilmstrip from '../PhotoFilmstrip'
import type { AiSummaryState } from '../../pages/PhotoWorkflowPage'

const CONDITIONS = ['New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const
type Condition = (typeof CONDITIONS)[number]

interface ReviewStepProps {
  lookupResult: BookLookup
  photos: File[]
  savedBookId: string | null
  onSavedBookId: (id: string) => void
  onSaveComplete: () => void
  onCancel: () => void
  skippedPhotography: boolean
  aiSummary: AiSummaryState
}

async function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxEdge = 1200
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxEdge || h > maxEdge) {
        if (w > h) { h = Math.round((h * maxEdge) / w); w = maxEdge }
        else { w = Math.round((w * maxEdge) / h); h = maxEdge }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

function ReviewToggleButton({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      aria-pressed={on}
      style={{
        padding: '0.6rem 0.5rem',
        height: 40,
        border: on ? 'none' : `1px solid ${theme.colors.zoneBorder}`,
        borderRadius: theme.radius.md,
        background: on ? theme.colors.primaryBlue : theme.colors.bg,
        color: on ? '#fff' : theme.colors.secondaryText,
        fontWeight: on ? 500 : 400,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: theme.font.sans,
      }}
    >
      {label}
    </button>
  )
}

export default function ReviewStep({
  lookupResult,
  photos,
  savedBookId,
  onSavedBookId,
  onSaveComplete,
  onCancel,
  skippedPhotography,
  aiSummary,
}: ReviewStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [reviewMetadata, setReviewMetadata] = useState(lookupResult.needs_metadata_review)
  const [reviewPhotography, setReviewPhotography] = useState(skippedPhotography)
  const [reviewDescription, setReviewDescription] = useState(true)
  const [localPhotos, setLocalPhotos] = useState<Array<{ id: string; file: File }>>(
    () => photos.map((file) => ({ id: crypto.randomUUID(), file }))
  )
  const [blobUrls, setBlobUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Create and revoke blob URLs whenever localPhotos changes
  useEffect(() => {
    const urls = localPhotos.map(({ file }) => URL.createObjectURL(file))
    setBlobUrls(urls)
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [localPhotos])

  // Re-assert review ON when an AI description arrives
  useEffect(() => {
    if (aiSummary.status === 'success') {
      setReviewDescription(true)
    }
  }, [aiSummary.status])

  function handleDeletePhoto(id: string) {
    const next = localPhotos.filter((p) => p.id !== id)
    setLocalPhotos(next)
    if (next.length === 0) {
      setReviewPhotography(true)
    }
  }

  async function handleSave() {
    if (!condition || saving) return
    setSaving(true)
    setError('')

    try {
      let bookId = savedBookId

      // Step 1: Create book if not already created
      if (!bookId) {
        // If the AI summary came back successfully, include it + source in the
        // single POST so the backend skips firing its own background task.
        const description = aiDescription ?? lookupResult.description ?? null
        const description_source = aiDescription
          ? 'ai_generated'
          : (lookupResult.description ? null : null)
        const book = await saveBook({
          ...lookupResult,
          description,
          condition,
          needs_metadata_review: reviewMetadata ? true : lookupResult.needs_metadata_review,
          needs_photo_review: reviewPhotography,
          needs_description_review: aiDescription ? reviewDescription : false,
          description_source,
          description_generation_failed: aiFailed,
        })
        bookId = book.id
        onSavedBookId(bookId)
      }

      // Step 2: Compress and upload photos (skip if none remain)
      if (localPhotos.length > 0) {
        const blobs = await Promise.all(localPhotos.map(({ file }) => compressPhoto(file)))
        await uploadPhotos(bookId, blobs)
      }

      onSaveComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — tap Save to retry photo upload')
    } finally {
      setSaving(false)
    }
  }

  const aiPending = aiSummary.status === 'pending'
  const aiDescription = aiSummary.status === 'success' ? aiSummary.text : null
  const aiFailed = aiSummary.status === 'failed'
  const showThirdToggle = !!aiDescription

  return (
    <WorkflowWrapper
      step="review"
      controls={null}
      primaryLabel={saving ? 'Saving…' : 'SAVE'}
      primaryDisabled={!condition || saving}
      onPrimary={handleSave}
      onCancel={onCancel}
    >
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          color: theme.colors.text,
        }}
      >
        <PhotoFilmstrip
          coverUrl={lookupResult.cover_image_url}
          photos={localPhotos.map(({ id }, i) => ({ key: id, url: blobUrls[i] ?? '' }))}
          onDelete={handleDeletePhoto}
        />

        {/* Metadata: title, author, year · publisher */}
        <div style={{ padding: '0.75rem 1.25rem 0' }}>
          {/* Title — bold, two-line max with ellipsis */}
          <h2
            style={{
              margin: '0 0 0.2rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              lineHeight: 1.35,
              color: theme.colors.text,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {lookupResult.title ?? 'Unknown Title'}
          </h2>

          {/* Author — one-line max with ellipsis */}
          <p
            style={{
              margin: '0 0 0.15rem',
              fontSize: '0.9rem',
              color: theme.colors.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {lookupResult.author ?? '—'}
          </p>

          {/* Year · Publisher — secondary text, one line */}
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.8rem',
              color: theme.colors.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {[lookupResult.year, lookupResult.publisher].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>

        <div style={{ padding: '0 1.25rem 1rem' }}>
          {/* Condition selector */}
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.75rem',
              color: theme.colors.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Condition
          </p>
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem' }}>
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.1rem',
                  fontSize: '0.72rem',
                  background: condition === c ? theme.colors.accent : theme.colors.subtle,
                  color: condition === c ? '#fff' : theme.colors.text,
                  border: condition === c
                    ? `1px solid ${theme.colors.accent}`
                    : `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: condition === c ? 600 : 400,
                  fontFamily: theme.font.sans,
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Review toggle buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showThirdToggle ? '1fr 1fr 1fr' : '1fr 1fr',
              gap: 8,
              marginBottom: '0.75rem',
            }}
          >
            <ReviewToggleButton
              label="review metadata"
              on={reviewMetadata}
              onToggle={setReviewMetadata}
            />
            <ReviewToggleButton
              label="review photography"
              on={reviewPhotography}
              onToggle={setReviewPhotography}
            />
            {showThirdToggle && (
              <ReviewToggleButton
                label="review description"
                on={reviewDescription}
                onToggle={setReviewDescription}
              />
            )}
          </div>

          {/* Description block — AI pending, success, or failure */}
          {(aiPending || aiDescription || aiFailed) && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p
                style={{
                  margin: '0 0 0.35rem',
                  fontSize: '0.72rem',
                  color: theme.colors.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Description
              </p>
              {aiPending && (
                <p style={{ margin: 0, fontStyle: 'italic', color: theme.colors.muted, fontSize: 13 }}>
                  Generating summary…
                </p>
              )}
              {aiDescription && (
                <p style={{ margin: 0, color: theme.colors.text, fontSize: 13, lineHeight: 1.45 }}>
                  {aiDescription}
                </p>
              )}
              {aiFailed && (
                <p style={{ margin: 0, fontStyle: 'italic', color: theme.colors.muted, fontSize: 13 }}>
                  Summary unavailable — you can add one on the edit page.
                </p>
              )}
            </div>
          )}

          {error && (
            <p style={{ color: theme.colors.danger, fontSize: '0.85rem', margin: '0.5rem 0' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </WorkflowWrapper>
  )
}
