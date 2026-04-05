import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Scanner from '../components/Scanner'
import PhoneReview from '../components/PhoneReview'
import { lookupIsbn, saveBook } from '../api/books'
import { useScanAudio } from '../hooks/useScanAudio'
import { BookLookup } from '../types'

type ScanState = 'scanning' | 'loading' | 'review' | 'error'

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('scanning')
  const [bookData, setBookData] = useState<BookLookup | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [isRetry, setIsRetry] = useState(false)
  const { playSuccess, playReview } = useScanAudio()

  const handleScan = useCallback(
    async (isbn: string) => {
      setState('loading')
      setErrorMsg('')
      setLastSaved(null)
      try {
        const data = await lookupIsbn(isbn)
        setBookData(data)
        if (data.data_complete) {
          playSuccess()
          setIsRetry(false)
        } else {
          playReview()
          setIsRetry(true)
        }
        setState('review')
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Lookup failed')
        setState('error')
      }
    },
    [playSuccess, playReview],
  )

  async function handleSave(book: BookLookup) {
    await saveBook(book)
    setLastSaved(book.title ?? book.isbn)
    setBookData(null)
    setIsRetry(false)
    setState('scanning')
  }

  function handleCancel() {
    setIsRetry(false)
    setState('scanning')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong>BookScan</strong>
        <Link to="/dashboard" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.9rem' }}>
          Dashboard →
        </Link>
      </div>

      {lastSaved && (
        <div
          style={{
            background: '#1a4a1a',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            color: '#8f8',
          }}
        >
          Saved: {lastSaved}
        </div>
      )}

      {state === 'scanning' && (
        <div style={{ padding: '1rem' }}>
          <Scanner onScan={handleScan} active={true} isRetry={isRetry} />
          <p
            style={{
              color: '#888',
              textAlign: 'center',
              marginTop: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            Align barcode within the frame and tap Scan
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
        <div style={{ background: '#fff', minHeight: '100vh' }}>
          <PhoneReview book={bookData} onSave={handleSave} onCancel={handleCancel} />
        </div>
      )}
    </div>
  )
}
