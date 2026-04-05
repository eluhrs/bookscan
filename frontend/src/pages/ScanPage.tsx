import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Scanner from '../components/Scanner'
import PhoneReview from '../components/PhoneReview'
import { lookupIsbn, saveBook } from '../api/books'
import { useScanAudio } from '../hooks/useScanAudio'
import { BookLookup } from '../types'
import { theme } from '../styles/theme'

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
    <div style={{ height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong>BookScan</strong>
        <Link to="/dashboard" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>
          Dashboard →
        </Link>
      </div>

      {lastSaved && (
        <div
          style={{
            background: '#052e16',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            color: '#8f8',
          }}
        >
          Saved: {lastSaved}
        </div>
      )}

      {state === 'scanning' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Scanner onScan={handleScan} onScanFail={playReview} active={true} isRetry={isRetry} />
        </div>
      )}

      {state === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Looking up…
        </div>
      )}

      {state === 'error' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <p style={{ color: theme.colors.danger }}>{errorMsg}</p>
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
