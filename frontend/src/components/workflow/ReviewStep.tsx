import { useState } from 'react'
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

export default function ReviewStep({
  lookupResult,
  photos,
  savedBookId,
  onSavedBookId,
  onSaveComplete,
  onCancel,
}: ReviewStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [flagForReview, setFlagForReview] = useState(!lookupResult.data_complete)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { playSuccess } = useScanAudio()

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
          data_complete: flagForReview ? false : lookupResult.data_complete,
        })
        bookId = book.id
        onSavedBookId(bookId)
      }

      // Step 2: Compress and upload photos
      const blobs = await Promise.all(photos.map(compressPhoto))
      await uploadPhotos(bookId, blobs)

      playSuccess()
      onSaveComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — tap Save to retry photo upload')
    } finally {
      setSaving(false)
    }
  }

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
          padding: '1rem 1.25rem',
          color: '#fff',
        }}
      >
        {/* Cover + metadata */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
          {lookupResult.cover_image_url && (
            <img
              src={lookupResult.cover_image_url}
              alt="Cover"
              style={{ width: 60, borderRadius: 4, flexShrink: 0 }}
            />
          )}
          <div>
            <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', lineHeight: 1.3 }}>
              {lookupResult.title ?? 'Unknown Title'}
            </h2>
            <p style={{ margin: '0 0 0.1rem', fontSize: '0.95rem', color: '#ccc' }}>
              {lookupResult.author ?? '—'}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
              {[lookupResult.year, lookupResult.publisher].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Condition selector */}
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Condition
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              style={{
                flex: 1,
                minWidth: 60,
                padding: '0.5rem 0.25rem',
                fontSize: '0.78rem',
                background: condition === c ? '#fff' : '#111',
                color: condition === c ? '#000' : '#aaa',
                border: condition === c ? '1px solid #fff' : '1px solid #333',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: condition === c ? 600 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Flag for review */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            marginBottom: '0.75rem',
            fontSize: '0.9rem',
            color: '#aaa',
          }}
        >
          <input
            type="checkbox"
            checked={flagForReview}
            onChange={(e) => setFlagForReview(e.target.checked)}
          />
          Flag for review
        </label>

        {error && (
          <p style={{ color: theme.colors.danger, fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</p>
        )}
      </div>
    </WorkflowWrapper>
  )
}
