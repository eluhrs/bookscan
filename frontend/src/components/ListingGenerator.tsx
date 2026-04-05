import { useState, useEffect, type CSSProperties } from 'react'
import { Book, Listing } from '../types'
import { generateListing, getBookListings } from '../api/listings'
import { theme } from '../styles/theme'

interface ListingGeneratorProps {
  book: Book
  onClose: () => void
}

export default function ListingGenerator({ book, onClose }: ListingGeneratorProps) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [history, setHistory] = useState<Listing[]>([])
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getBookListings(book.id).then(setHistory).catch(() => {})
  }, [book.id])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    setCopied(false)
    try {
      const l = await generateListing(book.id)
      setListing(l)
      setHistory((h) => [l, ...h])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!listing) return
    try {
      await navigator.clipboard.writeText(listing.listing_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  const btnStyle = (variant: 'primary' | 'secondary'): CSSProperties => ({
    padding: '0.5rem 0.9rem',
    fontSize: '0.85rem',
    fontWeight: 500,
    border: variant === 'primary' ? 'none' : `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: variant === 'primary' ? theme.colors.text : theme.colors.bg,
    color: variant === 'primary' ? '#fff' : theme.colors.text,
    cursor: 'pointer',
    fontFamily: theme.font.sans,
  })

  return (
    <div style={{ fontFamily: theme.font.sans }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 600 }}>
            {book.title ?? book.isbn}
          </h2>
          {book.author && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: theme.colors.muted }}>
              {book.author}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.colors.muted,
            fontSize: '1.1rem',
            padding: '0 0.25rem',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={handleGenerate} disabled={generating} style={btnStyle('primary')}>
          {generating ? 'Generating…' : 'Generate Listing'}
        </button>
        {listing && (
          <button onClick={handleCopy} style={btnStyle('secondary')}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: theme.colors.danger, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          {error}
        </p>
      )}

      {listing && (
        <pre
          style={{
            padding: '0.75rem 1rem',
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.82rem',
            fontFamily: theme.font.mono,
            lineHeight: 1.6,
            margin: '0 0 1rem',
          }}
        >
          {listing.listing_text}
        </pre>
      )}

      {history.filter((h) => h.id !== listing?.id).length > 0 && (
        <div>
          <p
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              color: theme.colors.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.5rem',
            }}
          >
            Previous listings
          </p>
          {history
            .filter((h) => h.id !== listing?.id)
            .map((h) => (
              <div
                key={h.id}
                style={{
                  borderTop: `1px solid ${theme.colors.border}`,
                  paddingTop: '0.5rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem',
                  color: theme.colors.muted,
                }}
              >
                <span>{new Date(h.created_at).toLocaleString()}</span>
                <button
                  onClick={() => setListing(h)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.accent,
                    fontSize: '0.82rem',
                    padding: 0,
                  }}
                >
                  View
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
