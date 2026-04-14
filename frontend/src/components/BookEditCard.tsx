// frontend/src/components/BookEditCard.tsx

import { useState, useEffect } from 'react'
import { Book, BookPhoto } from '../types'
import { theme } from '../styles/theme'
import { useBreakpoint } from '../hooks/useBreakpoint'
import PhotoFilmstrip from './PhotoFilmstrip'

interface BookEditCardProps {
  book: Book
  photos: BookPhoto[]
  photoUrls: Record<string, string>
  totalCount: number
  onDeletePhoto: (photoId: string) => Promise<void>
  onAddPhoto: (file: File) => Promise<void>
  onSave: (updates: Partial<Book>) => Promise<void>
  onImmediateSave: (updates: Partial<Book>) => Promise<void>
  onBack: () => void
  onSaved?: () => void
  onLogout: () => void
  onGenerateListing: () => void
}

interface DraftFields {
  title: string | null
  author: string | null
  pages: number | null
  publisher: string | null
  edition: string | null
  dimensions: string | null
  weight: string | null
  description: string | null
  condition: string | null
}

const CONDITIONS = ['New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const

const SMALL_CAPS_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: theme.colors.muted,
  marginBottom: 2,
}

// ---- InlineField ----
interface InlineFieldProps {
  value: string | number | null
  onChange: (v: string) => void
  fontSize?: number
  fontWeight?: number
  color?: string
  mono?: boolean
  multiline?: boolean
  placeholder?: string
}

function InlineField({
  value,
  onChange,
  fontSize = 13,
  fontWeight = 400,
  color = theme.colors.subtleText,
  mono = false,
  multiline = false,
  placeholder = '',
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value))
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    setLocal(value === null || value === undefined ? '' : String(value))
  }, [value])

  const displayStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color: local ? color : theme.colors.muted,
    fontStyle: local ? 'normal' : 'italic',
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    cursor: 'text',
    display: 'block',
    minHeight: '1.4em',
    padding: '1px 3px',
    borderRadius: 3,
    border: hovered ? `0.5px solid ${theme.colors.border}` : '0.5px solid transparent',
    lineHeight: 1.4,
    whiteSpace: multiline ? 'pre-wrap' : undefined,
  }

  const inputStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color,
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    width: '100%',
    padding: '1px 3px',
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: 3,
    outline: 'none',
    resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 160 : undefined,
    lineHeight: 1.4,
    boxSizing: 'border-box',
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          value={local}
          style={inputStyle}
          autoFocus
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            setEditing(false)
            onChange(local)
          }}
        />
      )
    }
    return (
      <input
        type="text"
        value={local}
        style={inputStyle}
        autoFocus
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onChange(local)
        }}
      />
    )
  }

  return (
    <span
      style={displayStyle}
      onClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {local || placeholder || '\u200b'}
    </span>
  )
}

// ---- ConditionBar ----
interface ConditionBarProps {
  value: string | null
  onChange: (v: string) => void
}

function ConditionBar({ value, onChange }: ConditionBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {CONDITIONS.map((c, i) => {
        const selected = value === c
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              flex: 1,
              padding: '0.5rem 0.4rem',
              fontSize: 12,
              fontWeight: selected ? 500 : 400,
              background: selected ? theme.colors.accent : theme.colors.bg,
              color: selected ? '#fff' : theme.colors.muted,
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              fontFamily: theme.font.sans,
              lineHeight: 1.2,
            }}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

// ---- BookEditCard ----
export default function BookEditCard({
  book,
  photos,
  photoUrls,
  totalCount,
  onDeletePhoto,
  onAddPhoto,
  onSave,
  onImmediateSave,
  onBack,
  onSaved,
  onLogout,
  onGenerateListing,
}: BookEditCardProps) {
  const { isMobile } = useBreakpoint()
  const [draft, setDraft] = useState<DraftFields>({
    title: book.title,
    author: book.author,
    pages: book.pages,
    publisher: book.publisher,
    edition: book.edition,
    dimensions: book.dimensions,
    weight: book.weight,
    description: book.description,
    condition: book.condition,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft({
      title: book.title,
      author: book.author,
      pages: book.pages,
      publisher: book.publisher,
      edition: book.edition,
      dimensions: book.dimensions,
      weight: book.weight,
      description: book.description,
      condition: book.condition,
    })
  }, [book.id])

  function setField<K extends keyof DraftFields>(key: K, raw: string) {
    setDraft((d) => ({
      ...d,
      [key]: key === 'pages'
        ? (raw ? Number(raw) : null)
        : (raw || null),
    }))
  }

  async function handleSaveChanges() {
    setSaving(true)
    setError('')
    try {
      await onSave(draft as Partial<Book>)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleConditionImmediate(v: string) {
    setDraft((d) => ({ ...d, condition: v }))
    try {
      await onImmediateSave({ condition: v })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleMetadataCheck(checked: boolean) {
    await onImmediateSave({ data_complete: !checked })
  }

  async function handlePhotographyCheck(checked: boolean) {
    await onImmediateSave({ needs_photo_review: checked })
  }

  // ---- Layout ----
  // Desktop: natural page flow — navbar, padded container with card, footer scrolls with content.
  // Mobile: footer anchored to bottom so SAVE is always accessible.

  const SAVE_BUTTON_HEIGHT = 44
  const FOOTER_TOTAL_HEIGHT = SAVE_BUTTON_HEIGHT + 44 + 12 /* vertical gap + secondary buttons */

  const secondaryButtonStyle: React.CSSProperties = {
    flex: 1,
    height: 44,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.bg,
    color: theme.colors.muted,
    cursor: 'pointer',
    fontFamily: theme.font.sans,
  }

  const footerContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={handleSaveChanges}
        disabled={saving}
        style={{
          width: '100%',
          height: SAVE_BUTTON_HEIGHT,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          border: 'none',
          borderRadius: theme.radius.md,
          background: saving ? theme.colors.disabled : '#0070F3',
          color: '#fff',
          cursor: saving ? 'default' : 'pointer',
          fontFamily: theme.font.sans,
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onBack} style={secondaryButtonStyle}>
          Dashboard
        </button>
        <button type="button" onClick={onGenerateListing} style={secondaryButtonStyle}>
          Generate Listing
        </button>
      </div>
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.pageBg,
        color: theme.colors.text,
        fontFamily: theme.font.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Navbar — matches dashboard */}
      <div
        style={{
          background: theme.colors.bg,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              BookScan
            </h1>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: theme.colors.muted }}>
              {totalCount} book{totalCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 500,
              color: theme.colors.text,
              textAlign: 'center',
              flex: 'none',
            }}
          >
            Edit Book
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onLogout}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                background: theme.colors.bg,
                cursor: 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div
        style={{
          flex: 1,
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          padding: isMobile ? '16px 16px 0' : '24px',
          paddingBottom: isMobile ? FOOTER_TOTAL_HEIGHT + 32 : 24,
          boxSizing: 'border-box',
        }}
      >
        {/* Card */}
        <div
          style={{
            background: theme.colors.bg,
            border: `0.5px solid ${theme.colors.border}`,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
          }}
        >
          {/* Filmstrip */}
          <PhotoFilmstrip
            coverUrl={book.cover_image_url}
            photos={photos.map((p) => ({ key: p.id, url: photoUrls[p.id] ?? '' }))}
            onDelete={onDeletePhoto}
            onAddPhoto={onAddPhoto}
          />

          {/* Content zone */}
          <div style={{ padding: '1.25rem', background: theme.colors.surface }}>
            {/* 2. Title / Author / Year · Publisher */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: 4 }}>
                <InlineField
                  value={draft.title}
                  onChange={(v) => setField('title', v)}
                  fontSize={20}
                  fontWeight={600}
                  color={theme.colors.text}
                />
              </div>
              <div style={{ marginBottom: 4 }}>
                <InlineField
                  value={draft.author}
                  onChange={(v) => setField('author', v)}
                  fontSize={14}
                  color={theme.colors.muted}
                />
              </div>
              <div style={{ fontSize: 13, color: theme.colors.muted, paddingLeft: 3 }}>
                {[book.year, book.publisher].filter(Boolean).join(' · ') || <em>—</em>}
              </div>
            </div>

            {/* 3. Condition segmented bar */}
            <div style={{ marginBottom: '0.75rem' }}>
              <ConditionBar
                value={draft.condition}
                onChange={handleConditionImmediate}
              />
            </div>

            {/* 4. Review checkboxes */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '6px 12px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                marginBottom: '1.25rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: 13,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                <input
                  type="checkbox"
                  aria-label="Review Metadata?"
                  checked={!book.data_complete}
                  onChange={(e) => handleMetadataCheck(e.target.checked)}
                />
                review metadata
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: 13,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                <input
                  type="checkbox"
                  aria-label="Review Photography?"
                  checked={book.needs_photo_review}
                  onChange={(e) => handlePhotographyCheck(e.target.checked)}
                />
                review photography
              </label>
            </div>

            {/* 5. ISBN / Pages / Publisher */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                paddingBottom: '1.25rem',
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              <div>
                <span style={SMALL_CAPS_LABEL}>ISBN</span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: theme.font.mono,
                    color: theme.colors.subtleText,
                    display: 'block',
                    padding: '1px 3px',
                    lineHeight: 1.4,
                  }}
                >
                  {book.isbn}
                </span>
              </div>
              <div>
                <span style={SMALL_CAPS_LABEL}>Pages</span>
                <InlineField
                  value={draft.pages}
                  onChange={(v) => setField('pages', v)}
                  placeholder="—"
                />
              </div>
              <div>
                <span style={SMALL_CAPS_LABEL}>Publisher</span>
                <InlineField
                  value={draft.publisher}
                  onChange={(v) => setField('publisher', v)}
                  placeholder="—"
                />
              </div>
            </div>

            {/* 6. Additional Fields */}
            <div
              style={{
                marginBottom: '1.25rem',
                paddingBottom: '1.25rem',
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              <span style={{ ...SMALL_CAPS_LABEL, marginBottom: 8 }}>Additional Fields</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                }}
              >
                {([
                  { key: 'edition', label: 'Edition' },
                  { key: 'dimensions', label: 'Dimensions' },
                  { key: 'weight', label: 'Weight' },
                ] as const).map(({ key, label }) => (
                  <div key={key}>
                    <span style={SMALL_CAPS_LABEL}>{label}</span>
                    <InlineField
                      value={draft[key]}
                      onChange={(v) => setField(key, v)}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 7. Description */}
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={SMALL_CAPS_LABEL}>Description</span>
              <InlineField
                value={draft.description}
                onChange={(v) => setField('description', v)}
                multiline
                fontSize={13}
                color={theme.colors.muted}
                placeholder="—"
              />
            </div>

            {error && (
              <p style={{ color: theme.colors.danger, fontSize: 13, marginTop: '0.75rem' }}>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Desktop footer — inline below the card, not anchored */}
        {!isMobile && <div style={{ marginTop: 16 }}>{footerContent}</div>}
      </div>

      {/* Mobile footer — anchored to bottom of viewport */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            background: theme.colors.bg,
            borderTop: `1px solid ${theme.colors.border}`,
            zIndex: 10,
          }}
        >
          {footerContent}
        </div>
      )}
    </div>
  )
}
