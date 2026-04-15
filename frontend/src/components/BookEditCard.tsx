// frontend/src/components/BookEditCard.tsx

import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { Book, BookPhoto } from '../types'
import { theme } from '../styles/theme'
import PhotoFilmstrip from './PhotoFilmstrip'
import { useVisualViewport } from '../hooks/useVisualViewport'

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
    border: hovered ? `0.5px solid ${theme.colors.zoneBorder}` : '0.5px solid transparent',
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
        border: `1px solid ${theme.colors.zoneBorder}`,
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
              borderLeft: i === 0 ? 'none' : `1px solid ${theme.colors.zoneBorder}`,
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

// ---- ReviewToggle ----
function ReviewToggle({ label, on, onToggle }: {
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
      const payload: Partial<Book> = { ...(draft as Partial<Book>) }
      if (draft.description !== book.description) {
        payload.description_source = 'manual'
      }
      await onSave(payload)
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

  const SAVE_BUTTON_HEIGHT = 44

  const secondaryButtonStyle: React.CSSProperties = {
    flex: 1,
    height: 44,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${theme.colors.zoneBorder}`,
    borderRadius: theme.radius.md,
    background: theme.colors.bg,
    color: theme.colors.secondaryText,
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
          background: saving ? theme.colors.disabled : theme.colors.primaryBlue,
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

  const { height: vpHeight, offsetTop: vpOffset } = useVisualViewport()

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        maxWidth: '100vw',
        height: vpHeight,
        transform: `translateY(${vpOffset}px)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        background: theme.colors.bg,
        color: theme.colors.text,
        fontFamily: theme.font.sans,
      }}
    >
      {/* Navbar — matches dashboard */}
      <div
        style={{
          flexShrink: 0,
          background: theme.colors.navBg,
          borderBottom: `1px solid ${theme.colors.zoneBorder}`,
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
                border: `1px solid ${theme.colors.zoneBorder}`,
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

      {/* Scrollable content zone */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          background: theme.colors.bg,
          borderLeft: `1px solid ${theme.colors.zoneBorder}`,
          borderRight: `1px solid ${theme.colors.zoneBorder}`,
          boxSizing: 'border-box',
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
        <div style={{ padding: '1.25rem' }}>
          {/* Title / Author / Year · Publisher */}
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

          {/* Condition segmented bar */}
          <div style={{ marginBottom: '0.75rem' }}>
            <ConditionBar
              value={draft.condition}
              onChange={handleConditionImmediate}
            />
          </div>

          {/* Review toggle buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginBottom: '1.25rem',
            }}
          >
            <ReviewToggle
              label="review metadata"
              on={book.needs_metadata_review}
              onToggle={(v) => onImmediateSave({ needs_metadata_review: v })}
            />
            <ReviewToggle
              label="review photography"
              on={book.needs_photo_review}
              onToggle={(v) => onImmediateSave({ needs_photo_review: v })}
            />
            <ReviewToggle
              label="review description"
              on={book.needs_description_review}
              onToggle={(v) => onImmediateSave({ needs_description_review: v })}
            />
          </div>

          {/* ISBN / Pages / Publisher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              paddingBottom: '1.25rem',
              borderBottom: `1px solid ${theme.colors.zoneBorder}`,
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

          {/* Additional Fields */}
          <div
            style={{
              marginBottom: '1.25rem',
              paddingBottom: '1.25rem',
              borderBottom: `1px solid ${theme.colors.zoneBorder}`,
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

          {/* Description */}
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ ...SMALL_CAPS_LABEL, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Description
              {book.description_source === 'ai_generated' && (
                <Sparkles size={14} color={theme.colors.aiPurple} aria-label="AI-generated summary" />
              )}
            </span>
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

      {/* Footer — anchored below scroll region on all breakpoints */}
      <div
        style={{
          flexShrink: 0,
          background: theme.colors.navBg,
          borderTop: `1px solid ${theme.colors.zoneBorder}`,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {footerContent}
        </div>
      </div>
    </div>
  )
}
