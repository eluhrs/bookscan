import { useState, useEffect } from 'react'
import { Book, Listing } from '../types'
import { generateListing, getBookListings } from '../api/listings'

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
    await navigator.clipboard.writeText(listing.listing_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Listing: {book.title ?? book.isbn}</h2>
        <button onClick={onClose}>✕ Close</button>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate Listing'}
        </button>
        {listing && (
          <button onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        )}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {listing && (
        <pre
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f5f5f5',
            borderRadius: 4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
          }}
        >
          {listing.listing_text}
        </pre>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>History ({history.length})</h3>
          {history.map((h) => (
            <div
              key={h.id}
              style={{
                borderTop: '1px solid #eee',
                paddingTop: '0.5rem',
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: '#666',
              }}
            >
              <span>{new Date(h.created_at).toLocaleString()}</span>
              <button
                onClick={() => setListing(h)}
                style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}
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
