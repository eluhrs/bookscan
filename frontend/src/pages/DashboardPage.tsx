import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import BookTable from '../components/BookTable'
import BookForm from '../components/BookForm'
import ListingGenerator from '../components/ListingGenerator'
import { listBooks, updateBook, deleteBook, exportListingsCSV } from '../api/books'
import { listPhotos, deletePhoto, getPhotoUrl } from '../api/photos'
import { Book, BookLookup, BookPhoto } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { theme } from '../styles/theme'

export default function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { isMobile } = useBreakpoint()
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

  async function handleEdit(updated: BookLookup, retainFlag?: boolean) {
    if (!editingBook) return
    try {
      await updateBook(editingBook.id, {
        title: updated.title,
        author: updated.author,
        publisher: updated.publisher,
        edition: updated.edition,
        year: updated.year,
        pages: updated.pages,
        subject: updated.subject,
        description: updated.description,
        cover_image_url: updated.cover_image_url,
        condition: updated.condition,
        ...(retainFlag === true ? { data_complete: false } : {}),
      })
      setEditingBook(null)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    }
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
    const asLookup: BookLookup = {
      isbn: editingBook.isbn,
      title: editingBook.title,
      author: editingBook.author,
      publisher: editingBook.publisher,
      edition: editingBook.edition,
      year: editingBook.year,
      pages: editingBook.pages,
      dimensions: editingBook.dimensions,
      weight: editingBook.weight,
      subject: editingBook.subject,
      description: editingBook.description,
      condition: editingBook.condition,
      cover_image_url: editingBook.cover_image_url,
      data_sources: editingBook.data_sources,
      data_complete: editingBook.data_complete,
    }
    return (
      <div
        style={{
          maxWidth: 560,
          margin: '2rem auto',
          padding: '0 1rem',
          fontFamily: theme.font.sans,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <button
            onClick={() => setEditingBook(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.colors.muted,
              fontSize: '1rem',
              padding: 0,
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Edit Book</h2>
        </div>
        {/* Photo grid */}
        {bookPhotos.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 500, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Photos ({bookPhotos.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {bookPhotos.map((photo) => (
                <div key={photo.id} style={{ position: 'relative' }}>
                  <img
                    src={photoUrls[photo.id] ?? ''}
                    alt="Book photo"
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    title="Delete photo"
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 20,
                      height: 20,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                    aria-label="Delete photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <BookForm initial={asLookup} onSave={handleEdit} onCancel={() => setEditingBook(null)} />
      </div>
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
          {isMobile && (
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

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search title, author, ISBN…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '0.5rem 0.75rem',
            fontSize: '0.9rem',
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
            gap: '0.4rem',
            whiteSpace: 'nowrap',
            fontSize: '0.85rem',
            color: theme.colors.muted,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => { setIncompleteOnly(e.target.checked); setPage(1) }}
          />
          Incomplete only
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
          }}
        >
          Export CSV
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
