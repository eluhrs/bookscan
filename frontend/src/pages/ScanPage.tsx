import { useState, useCallback } from 'react'
import Scanner from '../components/Scanner'
import BookForm from '../components/BookForm'
import { lookupIsbn, saveBook } from '../api/books'
import { BookLookup } from '../types'

type ScanState = 'scanning' | 'loading' | 'review' | 'error'

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('scanning')
  const [bookData, setBookData] = useState<BookLookup | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const handleScan = useCallback(async (isbn: string) => {
    setState('loading')
    setErrorMsg('')
    try {
      const data = await lookupIsbn(isbn)
      setBookData(data)
      setState('review')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Lookup failed')
      setState('error')
    }
  }, [])

  async function handleSave(book: BookLookup) {
    await saveBook({
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      edition: book.edition,
      year: book.year,
      pages: book.pages,
      dimensions: book.dimensions,
      weight: book.weight,
      subject: book.subject,
      description: book.description,
      cover_image_url: book.cover_image_url,
      data_sources: book.data_sources,
      data_complete: book.data_complete,
    })
    setLastSaved(book.title ?? book.isbn)
    setBookData(null)
    setState('scanning')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>BookScan</strong>
        <a href="/dashboard" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.9rem' }}>
          Dashboard →
        </a>
      </div>

      {lastSaved && (
        <div style={{ background: '#1a4a1a', padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#8f8' }}>
          Saved: {lastSaved}
        </div>
      )}

      {state === 'scanning' && (
        <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
          <Scanner onScan={handleScan} active={true} />
          <p style={{ color: '#888', marginTop: '1rem', fontSize: '0.9rem' }}>
            Point camera at barcode
          </p>
        </div>
      )}

      {state === 'loading' && (
        <div style={{ textAlign: 'center', paddingTop: '4rem', color: '#888' }}>
          Looking up…
        </div>
      )}

      {state === 'error' && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'red' }}>{errorMsg}</p>
          <button
            onClick={() => setState('scanning')}
            style={{ marginTop: '1rem', padding: '0.75rem 1.5rem' }}
          >
            Try Again
          </button>
        </div>
      )}

      {state === 'review' && bookData && (
        <div style={{ background: '#fff', color: '#000', minHeight: '100vh' }}>
          <BookForm
            initial={bookData}
            onSave={handleSave}
            onCancel={() => setState('scanning')}
          />
        </div>
      )}
    </div>
  )
}
