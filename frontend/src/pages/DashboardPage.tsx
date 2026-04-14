import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import BookTable from '../components/BookTable'
import BookEditCard from '../components/BookEditCard'
import ListingGenerator from '../components/ListingGenerator'
import { listBooks, updateBook, deleteBook, exportListingsCSV } from '../api/books'
import { listPhotos, deletePhoto, getPhotoUrl, uploadPhotos } from '../api/photos'
import { Book, BookPhoto } from '../types'
import { useAuth } from '../hooks/useAuth'
import { isMobileDevice } from '../utils/deviceDetect'
import { theme } from '../styles/theme'

export default function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [listingBook, setListingBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(false)
  const [bookPhotos, setBookPhotos] = useState<BookPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listBooks({
        page,
        page_size: PAGE_SIZE,
        incomplete_only: incompleteOnly,
        search: search || undefined,
      })
      setBooks(result.items)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [page, incompleteOnly, search])

  const poll = useCallback(async () => {
    try {
      const result = await listBooks({
        page,
        page_size: PAGE_SIZE,
        incomplete_only: incompleteOnly,
        search: search || undefined,
      })
      setBooks(result.items)
      setTotal(result.total)
    } catch {
      // Ignore silent poll errors
    }
  }, [page, incompleteOnly, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    function start() {
      if (document.visibilityState === 'visible') {
        interval = setInterval(poll, 3000)
      }
    }

    function handleVisibility() {
      if (interval) clearInterval(interval)
      start()
    }

    start()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [poll])

  useEffect(() => {
    if (!editingBook) {
      setPhotoUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
        return {}
      })
      setBookPhotos([])
      return
    }

    let cancelled = false
    const urlsCreated: string[] = []

    listPhotos(editingBook.id)
      .then(async (photos) => {
        if (cancelled) return
        setBookPhotos(photos)
        const urls: Record<string, string> = {}
        await Promise.all(
          photos.map(async (p) => {
            try {
              const url = await getPhotoUrl(p.id)
              if (cancelled) { URL.revokeObjectURL(url); return }
              urls[p.id] = url
              urlsCreated.push(url)
            } catch {
              // Photo file missing — skip
            }
          })
        )
        if (!cancelled) setPhotoUrls(urls)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      urlsCreated.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [editingBook?.id])

  async function handleDeletePhoto(photoId: string) {
    try {
      await deletePhoto(photoId)
      if (photoUrls[photoId]) URL.revokeObjectURL(photoUrls[photoId])
      setPhotoUrls((prev) => { const next = { ...prev }; delete next[photoId]; return next })
      setBookPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function handleAddPhoto(file: File) {
    if (!editingBook) return
    try {
      await uploadPhotos(editingBook.id, [file])
      const allPhotos = await listPhotos(editingBook.id)
      setBookPhotos(allPhotos)
      setPhotoUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
        return {}
      })
      const urls: Record<string, string> = {}
      await Promise.all(
        allPhotos.map(async (p) => {
          try {
            urls[p.id] = await getPhotoUrl(p.id)
          } catch {
            // photo not found — skip
          }
        })
      )
      setPhotoUrls(urls)
      setEditingBook((prev) => prev ? { ...prev, has_photos: true } : null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  async function handleSave(updates: Partial<Book>) {
    if (!editingBook) return
    const updated = await updateBook(editingBook.id, updates)
    setEditingBook(updated)
    load()
  }

  async function handleImmediateSave(updates: Partial<Book>) {
    if (!editingBook) return
    const updated = await updateBook(editingBook.id, updates)
    setEditingBook(updated)
  }

  async function handleDelete(id: string) {
    try {
      await deleteBook(id)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (editingBook) {
    return (
      <>
        <BookEditCard
          book={editingBook}
          photos={bookPhotos}
          photoUrls={photoUrls}
          totalCount={total}
          onDeletePhoto={handleDeletePhoto}
          onAddPhoto={handleAddPhoto}
          onSave={handleSave}
          onImmediateSave={handleImmediateSave}
          onBack={() => setEditingBook(null)}
          onSaved={() => setEditingBook(null)}
          onLogout={logout}
          onGenerateListing={() => setListingBook(editingBook)}
        />
        {listingBook && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              overflowY: 'auto',
              padding: '2rem',
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: theme.colors.bg,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                boxShadow: theme.shadow.card,
                width: '100%',
                maxWidth: 640,
                padding: '1.5rem',
              }}
            >
              <ListingGenerator book={listingBook} onClose={() => setListingBook(null)} />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ padding: '1.5rem', fontFamily: theme.font.sans, maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            BookScan
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: theme.colors.muted }}>
            {total} book{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isMobileDevice() && (
            <button
              aria-label="Scan books"
              onClick={() => navigate('/scan')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.4rem 0.5rem',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                background: theme.colors.bg,
                cursor: 'pointer',
                color: theme.colors.text,
              }}
            >
              <Camera size={18} />
            </button>
          )}
          <button
            onClick={logout}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.85rem',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              background: theme.colors.bg,
              cursor: 'pointer',
              fontFamily: theme.font.sans,
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <input
          placeholder="Search books..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0.5rem 0.6rem',
            fontSize: '0.85rem',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            fontFamily: theme.font.sans,
            outline: 'none',
          }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            whiteSpace: 'nowrap',
            fontSize: '0.85rem',
            color: theme.colors.muted,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => { setIncompleteOnly(e.target.checked); setPage(1) }}
          />
          Incomplete
        </label>
        <button
          onClick={() => exportListingsCSV().catch(() => alert('Export failed'))}
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            background: theme.colors.bg,
            cursor: 'pointer',
            fontFamily: theme.font.sans,
            flexShrink: 0,
          }}
        >
          CSV
        </button>
      </div>

      {loading ? (
        <p style={{ color: theme.colors.muted, fontSize: '0.9rem' }}>Loading…</p>
      ) : (
        <BookTable
          books={books}
          onEdit={(b) => setEditingBook(b)}
          onDelete={handleDelete}
          onGenerateListing={(b) => setListingBook(b)}
        />
      )}

      {totalPages > 1 && (
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '0.85rem',
          }}
        >
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '0.35rem 0.65rem',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              background: theme.colors.bg,
              cursor: page === 1 ? 'default' : 'pointer',
              opacity: page === 1 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ color: theme.colors.muted }}>Page {page} of {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '0.35rem 0.65rem',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              background: theme.colors.bg,
              cursor: page === totalPages ? 'default' : 'pointer',
              opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}

      {listingBook && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: '2rem',
          }}
        >
          <div
            style={{
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              boxShadow: theme.shadow.card,
              width: '100%',
              maxWidth: 640,
              padding: '1.5rem',
            }}
          >
            <ListingGenerator book={listingBook} onClose={() => setListingBook(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
