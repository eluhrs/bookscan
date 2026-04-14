// frontend/src/components/BookEditCard.tsx

import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Book, BookPhoto } from '../types'
import { theme } from '../styles/theme'
import PhotoFilmstrip from './PhotoFilmstrip'

interface BookEditCardProps {
  book: Book
  photos: BookPhoto[]
  photoUrls: Record<string, string>
  onDeletePhoto: (photoId: string) => Promise<void>
  onAddPhoto: (file: File) => Promise<void>
  onSave: (updates: Partial<Book>) => Promise<void>
  onImmediateSave: (updates: Partial<Book>) => Promise<void>
  onBack: () => void
  onSaved?: () => void
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
    minHeight: multiline ? 80 : undefined,
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
  onDeletePhoto,
  onAddPhoto,
  onSave,
  onImmediateSave,
  onBack,
  onSaved,
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

  // Visual viewport tracking for anchored layout (mirrors WorkflowWrapper).
  const [vpHeight, setVpHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  )
  const [vpOffset, setVpOffset] = useState(
    () => window.visualViewport?.offsetTop ?? 0
  )

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setVpHeight(vv.height)
      setVpOffset(vv.offsetTop)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

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
      // Forward data_complete and needs_photo_review explicitly so the API does
      // not auto-recalculate data_complete and clobber the user's review override.
      await onSave({
        ...(draft as Partial<Book>),
        data_complete: book.data_complete,
        needs_photo_review: book.needs_photo_review,
      })
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

  const addedDate = new Date(book.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        maxWidth: 1200,
        margin: '0 auto',
        height: vpHeight,
        transform: `translateY(${vpOffset}px)`,
        background: theme.colors.surface,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        fontFamily: theme.font.sans,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
      }}
    >
      {/* Anchored header */}
      <div
        style={{
          flexShrink: 0,
          background: theme.colors.zoneBg,
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '0.3rem 0.75rem 0.3rem 0.5rem',
            fontSize: 12,
            background: theme.colors.bg,
            color: theme.colors.subtleText,
            border: `1.5px solid ${theme.colors.border}`,
            borderRadius: 999,
            cursor: 'pointer',
            fontFamily: theme.font.sans,
          }}
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: theme.colors.text }}>
          Edit Book
        </span>
      </div>

      {/* Filmstrip — flush against header, not scrollable vertically */}
      <PhotoFilmstrip
        coverUrl={book.cover_image_url}
        photos={photos.map((p) => ({ key: p.id, url: photoUrls[p.id] ?? '' }))}
        onDelete={onDeletePhoto}
        onAddPhoto={onAddPhoto}
      />

      {/* Scrollable content zone */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          background: theme.colors.surface,
        }}
      >
        <div>
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

          {/* Bordered checkbox group */}
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

          {/* ISBN / Pages / Publisher */}
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

          {/* Description */}
          <div
            style={{
              marginBottom: '1.25rem',
              paddingBottom: '1.25rem',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
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

          {/* Additional fields */}
          <div style={{ marginBottom: '1rem' }}>
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

          {error && (
            <p style={{ color: theme.colors.danger, fontSize: 13, marginBottom: '0.5rem' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Anchored footer */}
      <div
        style={{
          flexShrink: 0,
          background: theme.colors.zoneBg,
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderTop: `1px solid ${theme.colors.border}`,
        }}
      >
        <span style={{ fontSize: 12, color: theme.colors.muted }}>
          added {addedDate}
        </span>
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          style={{
            padding: '0.5rem 1.25rem',
            fontSize: 13,
            fontWeight: 500,
            border: 'none',
            borderRadius: theme.radius.md,
            background: saving ? theme.colors.muted : theme.colors.accent,
            color: '#fff',
            cursor: saving ? 'default' : 'pointer',
            fontFamily: theme.font.sans,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
