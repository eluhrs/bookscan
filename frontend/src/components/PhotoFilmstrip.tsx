// frontend/src/components/PhotoFilmstrip.tsx

import { useRef } from 'react'
import { theme } from '../styles/theme'

const FILMSTRIP_HEIGHT = 120
const COVER_WIDTH = Math.round(FILMSTRIP_HEIGHT * (2 / 3))  // 80px — 2:3 portrait
const PHOTO_WIDTH = Math.round(FILMSTRIP_HEIGHT * (3 / 4))  // 90px — 4:3 landscape

interface PhotoFilmstripProps {
  /** Cover image URL from metadata lookup. null shows a placeholder. Not deletable. */
  coverUrl: string | null
  /** User-uploaded photos as { key, url } pairs. key is passed to onDelete. */
  photos: Array<{ key: string; url: string }>
  /** Called with the photo's key when the user taps the ✕ delete button. */
  onDelete: (key: string) => void
  /** When provided, renders a + placeholder at the end that opens a file picker. */
  onAddPhoto?: (file: File) => void
}

export default function PhotoFilmstrip({ coverUrl, photos, onDelete, onAddPhoto }: PhotoFilmstripProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        padding: '0.75rem 1rem',
        flexShrink: 0,
        background: theme.colors.subtle,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Cover image — accent border signals lookup result, not deletable */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {coverUrl ? (
          <img
            src={coverUrl}
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

      {/* User photos — with ✕ delete button */}
      {photos.map((photo, i) => (
        <div key={photo.key} style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={photo.url}
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
            onClick={() => onDelete(photo.key)}
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: theme.colors.subtle,
              color: theme.colors.muted,
              border: `1px solid ${theme.colors.border}`,
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

      {/* + placeholder — shown when onAddPhoto is provided */}
      {onAddPhoto && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                onAddPhoto(file)
                e.target.value = ''
              }
            }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Add photo"
            style={{
              width: PHOTO_WIDTH,
              height: FILMSTRIP_HEIGHT,
              flexShrink: 0,
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: theme.colors.muted,
              fontSize: 22,
              fontWeight: 300,
              userSelect: 'none',
            }}
          >
            +
          </div>
        </>
      )}
    </div>
  )
}
