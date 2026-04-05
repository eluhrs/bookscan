import { useState } from 'react'
import { BookLookup } from '../types'
import { theme } from '../styles/theme'

const CONDITIONS = ['New', 'Very Good', 'Good', 'Acceptable'] as const
type Condition = (typeof CONDITIONS)[number]

interface PhoneReviewProps {
  book: BookLookup
  onSave: (book: BookLookup) => Promise<void>
  onCancel: () => void
}

export default function PhoneReview({ book, onSave, onCancel }: PhoneReviewProps) {
  const [condition, setCondition] = useState<Condition>('Very Good')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onSave({ ...book, condition })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 480, margin: '0 auto', color: theme.colors.text }}>
      {book.cover_image_url && (
        <img
          src={book.cover_image_url}
          alt="Cover"
          style={{ width: 72, borderRadius: 4, marginBottom: '0.75rem' }}
        />
      )}

      <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', lineHeight: 1.3 }}>
        {book.title ?? 'Unknown Title'}
      </h2>
      <p style={{ margin: '0 0 0.15rem', color: '#333', fontSize: '1rem' }}>
        {book.author ?? '—'}
      </p>
      <p style={{ margin: '0 0 0.75rem', color: theme.colors.muted, fontSize: '0.9rem' }}>
        {[book.year, book.publisher].filter(Boolean).join(' · ')}
      </p>

      {!book.data_complete && (
        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FCD34D',
            borderRadius: 6,
            padding: '0.6rem 0.75rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: '#92400E',
          }}
        >
          Incomplete data — flag retained for desktop review
        </div>
      )}

      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#666', fontWeight: 500 }}>
        Condition
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {CONDITIONS.map((c) => (
          <button
            key={c}
            onClick={() => setCondition(c)}
            style={{
              flex: 1,
              padding: '0.6rem 0.2rem',
              fontSize: '0.78rem',
              background: condition === c ? '#000' : theme.colors.surface,
              color: condition === c ? '#fff' : '#374151',
              border: condition === c ? '1px solid #000' : `1px solid ${theme.colors.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: condition === c ? 600 : 400,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ color: 'red', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          display: 'block',
          width: '100%',
          padding: '1rem',
          fontSize: '1.1rem',
          fontWeight: 600,
          background: theme.colors.scanGreen,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.7 : 1,
          marginBottom: '0.75rem',
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.muted,
            cursor: 'pointer',
            fontSize: '0.9rem',
            padding: '0.5rem',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
