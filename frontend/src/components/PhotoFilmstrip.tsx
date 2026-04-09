// frontend/src/components/PhotoFilmstrip.tsx

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
}

export default function PhotoFilmstrip({ coverUrl, photos, onDelete }: PhotoFilmstripProps) {
  return (
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
  )
}
