// frontend/src/components/workflow/ReviewStep.tsx

import { useState, useEffect } from 'react'
import WorkflowWrapper from './WorkflowWrapper'
import { BookLookup } from '../../types'
import { saveBook } from '../../api/books'
import { uploadPhotos } from '../../api/photos'
import { useScanAudio } from '../../hooks/useScanAudio'
import { theme } from '../../styles/theme'

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

const FILMSTRIP_HEIGHT = 120
const COVER_WIDTH = Math.round(FILMSTRIP_HEIGHT * (2 / 3))  // 80px (2:3 portrait)
const PHOTO_WIDTH = Math.round(FILMSTRIP_HEIGHT * (3 / 4))  // 90px (4:3 landscape)

export default function ReviewStep({
  lookupResult,
  photos,
  savedBookId,
  onSavedBookId,
  onSaveComplete,
  onCancel,
  skippedPhotography,
}: ReviewStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [reviewMetadata, setReviewMetadata] = useState(!lookupResult.data_complete)
  const [reviewPhotography, setReviewPhotography] = useState(skippedPhotography)
  const [localPhotos, setLocalPhotos] = useState<File[]>(photos)
  const [blobUrls, setBlobUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { playSuccess } = useScanAudio()

  // Create and revoke blob URLs whenever localPhotos changes
  useEffect(() => {
    const urls = localPhotos.map((f) => URL.createObjectURL(f))
    setBlobUrls(urls)
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [localPhotos])

  function handleDeletePhoto(index: number) {
    const next = localPhotos.filter((_, i) => i !== index)
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
        const book = await saveBook({
          ...lookupResult,
          condition,
          data_complete: reviewMetadata ? false : lookupResult.data_complete,
          needs_photo_review: reviewPhotography,
        })
        bookId = book.id
        onSavedBookId(bookId)
      }

      // Step 2: Compress and upload photos (skip if none remain)
      if (localPhotos.length > 0) {
        const blobs = await Promise.all(localPhotos.map(compressPhoto))
        await uploadPhotos(bookId, blobs)
      }

      playSuccess()
      onSaveComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — tap Save to retry photo upload')
    } finally {
      setSaving(false)
    }
  }

  const hasCover = Boolean(lookupResult.cover_image_url)

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
        {/* Filmstrip: cover image (no ✕, accent border) + user photos (with ✕) */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.75rem 1rem',
            flexShrink: 0,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Cover image — accent border signals it is a lookup result, not deletable */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {hasCover ? (
              <img
                src={lookupResult.cover_image_url!}
                alt="Cover"
                style={{
                  width: COVER_WIDTH,
                  height: FILMSTRIP_HEIGHT,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: `2px solid ${theme.colors.accent}`,
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: COVER_WIDTH,
                  height: FILMSTRIP_HEIGHT,
                  background: theme.colors.subtle,
                  borderRadius: 6,
                  border: `2px solid ${theme.colors.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  color: theme.colors.muted,
                  textAlign: 'center',
                  padding: '0 4px',
                }}
              >
                No cover
              </div>
            )}
          </div>

          {/* User photos — standard filmstrip style with ✕ delete button */}
          {blobUrls.map((url, i) => (
            <div key={`${url}-${i}`} style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                style={{
                  width: PHOTO_WIDTH,
                  height: FILMSTRIP_HEIGHT,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: `1px solid ${theme.colors.border}`,
                  display: 'block',
                }}
              />
              <button
                aria-label="Delete photo"
                onClick={() => handleDeletePhoto(i)}
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  padding: 0,
                  fontFamily: theme.font.sans,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

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

          {/* Review Metadata? checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: theme.colors.text,
            }}
          >
            <input
              type="checkbox"
              checked={reviewMetadata}
              onChange={(e) => setReviewMetadata(e.target.checked)}
            />
            Review Metadata?
          </label>

          {/* Review Photography? checkbox — auto-checked when skippedPhotography or all photos deleted */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              marginBottom: '0.75rem',
              fontSize: '0.875rem',
              color: theme.colors.text,
            }}
          >
            <input
              type="checkbox"
              checked={reviewPhotography}
              onChange={(e) => setReviewPhotography(e.target.checked)}
            />
            Review Photography?
          </label>

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
