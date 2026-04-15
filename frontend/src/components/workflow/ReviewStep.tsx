// frontend/src/components/workflow/ReviewStep.tsx

import { useState, useEffect, useMemo, useRef } from 'react'
import WorkflowWrapper from './WorkflowWrapper'
import { Book, BookLookup } from '../../types'
import { saveBook } from '../../api/books'
import { uploadPhotos } from '../../api/photos'
import BookCard, { BookCardHandle } from '../BookCard'
import type { AiSummaryState } from '../../pages/PhotoWorkflowPage'

// Condition options match eBay's used-book condition scale.
const CONDITIONS = ['Very Good', 'Good', 'Acceptable'] as const
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
  onRegenerateSummary: () => void
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
  skippedPhotography,
  aiSummary,
  onRegenerateSummary,
}: ReviewStepProps) {
  const [condition, setCondition] = useState<Condition | null>(null)
  const [reviewMetadata, setReviewMetadata] = useState(lookupResult.needs_metadata_review)
  const [reviewPhotography, setReviewPhotography] = useState(skippedPhotography)
  // Default OFF when the public-source lookup already returned a description
  // (Google Books etc.) — no AI is called and no user review is needed.
  // Default ON otherwise, so AI-generated summaries flag themselves for review.
  const [reviewDescription, setReviewDescription] = useState(!lookupResult.description)
  const [localPhotos, setLocalPhotos] = useState<Array<{ id: string; file: File }>>(
    () => photos.map((file) => ({ id: crypto.randomUUID(), file }))
  )
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bookCardRef = useRef<BookCardHandle>(null)

  // Create and revoke blob URLs whenever localPhotos changes
  useEffect(() => {
    const map: Record<string, string> = {}
    localPhotos.forEach(({ id, file }) => {
      map[id] = URL.createObjectURL(file)
    })
    setBlobUrls(map)
    return () => {
      Object.values(map).forEach((u) => URL.revokeObjectURL(u))
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

  // FEAT-05: append a new photo to the in-memory list (does not navigate away)
  function handleAddPhoto(file: File) {
    const id = crypto.randomUUID()
    setLocalPhotos((prev) => [...prev, { id, file }])
  }

  // Handles condition + review toggles from BookCard without hitting the network
  // (no saved book exists yet at review time).
  const reviewImmediateSave = async (patch: Partial<Book>) => {
    if ('condition' in patch) setCondition((patch.condition ?? null) as Condition | null)
    if ('needs_metadata_review' in patch) setReviewMetadata(!!patch.needs_metadata_review)
    if ('needs_photo_review' in patch) setReviewPhotography(!!patch.needs_photo_review)
    if ('needs_description_review' in patch) setReviewDescription(!!patch.needs_description_review)
  }

  const aiPending = aiSummary.status === 'pending'
  const aiDescription = aiSummary.status === 'success' ? aiSummary.text : null

  // Build a virtual Book object so BookCard can render without a persisted record.
  // The 'pending' sentinel id is intentional — no API call has been made yet.
  const virtualBook = useMemo(() => ({
    id: savedBookId ?? 'pending',
    isbn: lookupResult.isbn,
    title: lookupResult.title,
    author: lookupResult.author,
    publisher: lookupResult.publisher,
    year: lookupResult.year,
    pages: lookupResult.pages,
    edition: lookupResult.edition ?? null,
    dimensions: null,
    weight: null,
    description: aiDescription ?? lookupResult.description ?? null,
    cover_image_url: lookupResult.cover_image_url ?? null,
    cover_image_local: null,
    data_sources: lookupResult.data_sources,
    needs_metadata_review: reviewMetadata,
    needs_photo_review: reviewPhotography,
    needs_description_review: reviewDescription,
    description_source: aiDescription
      ? 'ai_generated'
      : (lookupResult.data_sources?.description ?? null),
    description_generation_failed: aiSummary.status === 'failed',
    condition: condition ?? null,
    has_photos: localPhotos.length > 0,
    created_at: '',
    updated_at: '',
  } as unknown as Book), [
    lookupResult,
    aiSummary,
    aiDescription,
    reviewMetadata,
    reviewPhotography,
    reviewDescription,
    condition,
    savedBookId,
    localPhotos.length,
  ])

  async function handleSave() {
    if (!condition || saving) return
    setSaving(true)
    setError('')

    try {
      let bookId = savedBookId

      // Step 1: Create book if not already created
      if (!bookId) {
        // Pull the latest user edits straight from BookCard's internal draft.
        // Review fields (title/author/publisher/isbn/year/pages/description)
        // are fully inline-editable, so draftPatch overrides the lookup values.
        const draftPatch = bookCardRef.current?.getDraft() ?? {}

        // Decide description_source. The buildPatch inside BookCard already
        // marks it 'manual' when the user typed over the description. When the
        // user did NOT edit, fall back to the context-appropriate source:
        // ai_generated when an AI summary succeeded, otherwise the catalog
        // source for a public-source description, otherwise null.
        const contextSource: string | null = aiDescription
          ? 'ai_generated'
          : lookupResult.description
            ? (lookupResult.data_sources?.description ?? null)
            : null
        const description_source =
          (draftPatch.description_source as string | undefined) ?? contextSource

        const book = await saveBook({
          isbn: (draftPatch.isbn as string | undefined) ?? lookupResult.isbn,
          title: draftPatch.title ?? lookupResult.title,
          author: draftPatch.author ?? lookupResult.author,
          publisher: draftPatch.publisher ?? lookupResult.publisher,
          edition: draftPatch.edition ?? lookupResult.edition,
          year: (draftPatch.year as number | null | undefined) ?? lookupResult.year,
          pages: (draftPatch.pages as number | null | undefined) ?? lookupResult.pages,
          dimensions: draftPatch.dimensions ?? lookupResult.dimensions,
          weight: draftPatch.weight ?? lookupResult.weight,
          description: draftPatch.description ?? aiDescription ?? lookupResult.description ?? null,
          cover_image_url: lookupResult.cover_image_url,
          data_sources: lookupResult.data_sources,
          condition,
          needs_metadata_review: reviewMetadata ? true : lookupResult.needs_metadata_review,
          needs_photo_review: reviewPhotography,
          needs_description_review: reviewDescription,
          description_source,
          description_generation_failed: aiSummary.status === 'failed',
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

  const effectiveDescriptionSource: string | null =
    aiDescription ? 'ai_generated'
    : lookupResult.description ? (lookupResult.data_sources?.description ?? null)
    : null

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
        className="mobile-scroll"
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <BookCard
          ref={bookCardRef}
          editable
          book={virtualBook}
          photos={localPhotos.map((p) => ({ key: p.id, url: blobUrls[p.id] ?? '' }))}
          photoUrls={blobUrls}
          onDeletePhoto={handleDeletePhoto}
          onAddPhoto={handleAddPhoto}
          onSave={async () => {}}
          onImmediateSave={reviewImmediateSave}
          onRegenerateDescription={onRegenerateSummary}
          regeneratingDescription={aiPending}
          descriptionSource={effectiveDescriptionSource}
        />

        {error && (
          <div style={{ padding: '0 1.25rem 1rem' }}>
            <p style={{ color: 'red', fontSize: '0.85rem', margin: '0.5rem 0' }}>
              {error}
            </p>
          </div>
        )}
      </div>
    </WorkflowWrapper>
  )
}
