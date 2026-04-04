import { useState } from 'react'
import { BookLookup } from '../types'

interface BookFormProps {
  initial: BookLookup
  onSave: (book: BookLookup) => Promise<void>
  onCancel: () => void
}

const FIELDS: Array<{ key: keyof BookLookup; label: string; type?: string }> = [
  { key: 'isbn', label: 'ISBN' },
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'edition', label: 'Edition' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'pages', label: 'Pages', type: 'number' },
  { key: 'subject', label: 'Subject' },
]

export default function BookForm({ initial, onSave, onCancel }: BookFormProps) {
  const [book, setBook] = useState<BookLookup>(initial)
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
      await onSave(book)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
      {book.cover_image_url && (
        <img
          src={book.cover_image_url}
          alt="Cover"
          style={{ width: 80, marginBottom: '1rem', borderRadius: 4 }}
        />
      )}
      {!book.data_complete && (
        <p style={{ color: 'orange', fontSize: '0.85rem' }}>
          Incomplete data — review before saving.
        </p>
      )}
      {FIELDS.map(({ key, label, type }) => (
        <div key={key} style={{ marginBottom: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#666' }}>{label}</label>
          <input
            type={type ?? 'text'}
            value={String(book[key] ?? '')}
            onChange={(e) => handleChange(key, e.target.value)}
            style={{ width: '100%', padding: '0.4rem', fontSize: '1rem' }}
          />
        </div>
      ))}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
        >
          {saving ? 'Saving…' : 'Save Book'}
        </button>
        <button onClick={onCancel} style={{ padding: '0.75rem' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
