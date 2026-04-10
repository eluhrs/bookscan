// frontend/src/components/BookEditCard.tsx

import { useState, useEffect } from 'react'
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
  onGenerateListing: () => void
}

interface DraftFields {
  title: string | null
  author: string | null
  isbn: string
  pages: number | null
  publisher: string | null
  edition: string | null
  dimensions: string | null
  weight: string | null
  description: string | null
  condition: string | null
}

const CONDITIONS = ['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const

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

// ---- BookEditCard ----
export default function BookEditCard({
  book,
  photos,
  photoUrls,
  onDeletePhoto,
  onAddPhoto,
  onSave,
  onImmediateSave,
  onGenerateListing,
}: BookEditCardProps) {
  const [draft, setDraft] = useState<DraftFields>({
    title: book.title,
    author: book.author,
    isbn: book.isbn,
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
      isbn: book.isbn,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
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
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        background: theme.colors.surface,
        fontFamily: theme.font.sans,
      }}
    >
      {/* Zone 1: Filmstrip */}
      <PhotoFilmstrip
        coverUrl={book.cover_image_url}
        photos={photos.map((p) => ({ key: p.id, url: photoUrls[p.id] ?? '' }))}
        onDelete={onDeletePhoto}
        onAddPhoto={onAddPhoto}
      />

      <div style={{ padding: '1rem' }}>
        {/* Zone 2: Title / Author / Status — two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          {/* Left: Title, Author, Year · Publisher */}
          <div>
            <div style={{ marginBottom: 4 }}>
              <InlineField
                value={draft.title}
                onChange={(v) => setField('title', v)}
                fontSize={20}
                fontWeight={500}
                color={theme.colors.text}
              />
            </div>
            <div style={{ marginBottom: 4 }}>
              <InlineField
                value={draft.author}
                onChange={(v) => setField('author', v)}
                fontSize={15}
                color={theme.colors.muted}
              />
            </div>
            <div style={{ fontSize: 13, color: theme.colors.muted, paddingLeft: 3 }}>
              {[book.year, book.publisher].filter(Boolean).join(' · ') || <em>—</em>}
            </div>
          </div>

          {/* Right: Condition, Review Metadata?, Review Photography? */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <select
              value={draft.condition ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, condition: e.target.value || null }))}
              style={{
                width: '100%',
                padding: '0.3rem 0.4rem',
                fontSize: 13,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                fontFamily: theme.font.sans,
                background: theme.colors.bg,
                color: theme.colors.text,
              }}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c || '— condition —'}</option>
              ))}
            </select>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: 13,
                color: theme.colors.text,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <input
                type="checkbox"
                aria-label="Review Metadata?"
                checked={!book.data_complete}
                onChange={(e) => handleMetadataCheck(e.target.checked)}
              />
              Review Metadata?
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: 13,
                color: theme.colors.text,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <input
                type="checkbox"
                aria-label="Review Photography?"
                checked={book.needs_photo_review}
                onChange={(e) => handlePhotographyCheck(e.target.checked)}
              />
              Review Photography?
            </label>
          </div>
        </div>

        {/* Zone 3: Core fields — ISBN, Pages, Publisher */}
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
          {([
            { key: 'isbn', label: 'ISBN', mono: true },
            { key: 'pages', label: 'Pages' },
            { key: 'publisher', label: 'Publisher' },
          ] as const).map(({ key, label, mono }) => (
            <div key={key}>
              <span style={SMALL_CAPS_LABEL}>{label}</span>
              <InlineField
                value={draft[key]}
                onChange={(v) => setField(key, v)}
                mono={mono}
              />
            </div>
          ))}
        </div>

        {/* Zone 4: Description */}
        <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: `1px solid ${theme.colors.border}` }}>
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

        {/* Zone 5: Additional fields — Edition, Dimensions, Weight */}
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
              />
            </div>
          ))}
        </div>

        {/* Zone 6: Footer */}
        {error && (
          <p style={{ color: theme.colors.danger, fontSize: 13, marginBottom: '0.5rem' }}>
            {error}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: theme.colors.muted }}>
            added {addedDate}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onGenerateListing}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: 13,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                background: theme.colors.bg,
                cursor: 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              generate listing
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                borderRadius: theme.radius.sm,
                background: saving ? theme.colors.muted : theme.colors.accent,
                color: '#fff',
                cursor: saving ? 'default' : 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              {saving ? 'Saving…' : 'save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
