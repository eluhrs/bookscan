import { useRef, useEffect } from 'react'
import WorkflowWrapper from './WorkflowWrapper'

interface PhotographStepProps {
  photos: File[]
  targetCount: number
  onTargetCountChange: (n: number) => void
  onPhotoAdded: (file: File) => void
  onCancel: () => void
}

export default function PhotographStep({
  photos,
  targetCount,
  onTargetCountChange,
  onPhotoAdded,
  onCancel,
}: PhotographStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Create blob URLs for thumbnails; revoke on cleanup
  const thumbUrls = useRef<string[]>([])
  useEffect(() => {
    // Revoke all previous URLs before creating new ones
    thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    thumbUrls.current = photos.map((f) => URL.createObjectURL(f))
    return () => {
      thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [photos])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onPhotoAdded(file)
      // Reset so the same file can be re-selected next press
      e.target.value = ''
    }
  }

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        Photos:
        <select
          value={targetCount}
          onChange={(e) => onTargetCountChange(Number(e.target.value))}
          style={{
            background: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: 4,
            padding: '0.2rem 0.4rem',
            fontSize: '0.85rem',
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <span style={{ fontSize: '0.8rem', color: '#666' }}>{photos.length} / {targetCount} captured</span>
    </div>
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <WorkflowWrapper
        step="photograph"
        controls={controls}
        primaryLabel="CAPTURE"
        onPrimary={() => inputRef.current?.click()}
        onCancel={onCancel}
      >
        {/* Thumbnail grid */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.75rem',
            alignContent: 'flex-start',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {photos.map((_, i) => (
            <img
              key={i}
              src={thumbUrls.current[i] ?? ''}
              alt={`Photo ${i + 1}`}
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
            />
          ))}
          {photos.length === 0 && (
            <p style={{ color: '#444', fontSize: '0.9rem', margin: 'auto', textAlign: 'center', width: '100%' }}>
              Tap CAPTURE to photograph the book
            </p>
          )}
        </div>
      </WorkflowWrapper>
    </>
  )
}
