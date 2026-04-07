import { useState, type CSSProperties } from 'react'
import { BookLookup } from '../types'
import { theme } from '../styles/theme'

interface BookFormProps {
  initial: BookLookup
  onSave: (book: BookLookup, retainFlag?: boolean) => Promise<void>
  onCancel: () => void
}

const TEXT_FIELDS: Array<{ key: keyof BookLookup; label: string; type?: string }> = [
  { key: 'isbn', label: 'ISBN' },
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'edition', label: 'Edition' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'pages', label: 'Pages', type: 'number' },
  { key: 'subject', label: 'Subject' },
]

const CONDITIONS = ['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'] as const

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.95rem',
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.sm,
  fontFamily: theme.font.sans,
  outline: 'none',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 500,
  color: theme.colors.muted,
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export default function BookForm({ initial, onSave, onCancel }: BookFormProps) {
  const [book, setBook] = useState<BookLookup>(initial)
  const [retainFlag, setRetainFlag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(key: keyof BookLookup, value: string) {
    setBook((b) => ({
      ...b,
      [key]: key === 'year' || key === 'pages' ? (value ? Number(value) : null) : value || null,
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onSave(book, retainFlag)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '0.25rem', fontFamily: theme.font.sans }}>
      {book.cover_image_url && (
        <img
          src={book.cover_image_url}
          alt="Cover"
          style={{ width: 72, marginBottom: '1rem', borderRadius: theme.radius.sm }}
        />
      )}
      {!initial.data_complete && (
        <div
          style={{
            background: theme.colors.warningBg,
            border: `1px solid ${theme.colors.warning}`,
            borderRadius: theme.radius.sm,
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: theme.colors.warningText,
          }}
        >
          Incomplete data — review before saving.
        </div>
      )}
      {TEXT_FIELDS.map(({ key, label, type }) => (
        <div key={key} style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>{label}</label>
          <input
            type={type ?? 'text'}
            value={String(book[key] ?? '')}
            onChange={(e) => handleChange(key, e.target.value)}
            style={inputStyle}
          />
        </div>
      ))}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={labelStyle}>Condition</label>
        <select
          value={book.condition ?? ''}
          onChange={(e) => setBook((b) => ({ ...b, condition: e.target.value || null }))}
          style={inputStyle}
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>{c || '— not set —'}</option>
          ))}
        </select>
      </div>
      {!initial.data_complete && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            <input
              type="checkbox"
              checked={retainFlag}
              onChange={(e) => setRetainFlag(e.target.checked)}
            />
            <span>Retain Flag</span>
          </label>
        </div>
      )}
      {error && (
        <p style={{ color: theme.colors.danger, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: '0.65rem',
            fontSize: '0.95rem',
            fontWeight: 500,
            background: saving ? theme.colors.muted : theme.colors.text,
            color: '#fff',
            border: 'none',
            borderRadius: theme.radius.sm,
            cursor: saving ? 'default' : 'pointer',
            fontFamily: theme.font.sans,
          }}
        >
          {saving ? 'Saving…' : 'Save Book'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '0.65rem 1rem',
            fontSize: '0.95rem',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            background: theme.colors.bg,
            cursor: 'pointer',
            fontFamily: theme.font.sans,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
