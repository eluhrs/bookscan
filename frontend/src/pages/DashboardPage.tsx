import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Camera, Download, X } from 'lucide-react'
import BookTable from '../components/BookTable'
import BookCard, { BookCardHandle } from '../components/BookCard'
import ListingGenerator from '../components/ListingGenerator'
import { StatusTagFilter, ReviewEyeFilter, StatusTagValue, ReviewEyeValue } from '../components/StatusFilter'
import { listBooks, updateBook, deleteBook, exportListingsCSV, getBook, generateSummary } from '../api/books'
import { listPhotos, deletePhoto, getPhotoUrl, uploadPhotos } from '../api/photos'
import { Book, BookPhoto } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useVisualViewport } from '../hooks/useVisualViewport'
import { isMobileDevice } from '../utils/deviceDetect'
import { exportBooks, getExportBatch, undoExportBatch, dismissExportBatch, ExportBatch } from '../api/exports'
import { theme } from '../styles/theme'

export default function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { height: vpHeight, offsetTop: vpOffset } = useVisualViewport()
  const [books, setBooks] = useState<Book[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusTagValue>('all')
  const [reviewFilter, setReviewFilter] = useState<ReviewEyeValue>('')
  const [search, setSearch] = useState('')
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [listingBook, setListingBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(false)
  const [bookPhotos, setBookPhotos] = useState<BookPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const bookCardRef = useRef<BookCardHandle>(null)
  const [exportBatch, setExportBatch] = useState<ExportBatch | null>(null)
  const [exporting, setExporting] = useState(false)
  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listBooks({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter,
        review: reviewFilter || undefined,
        search: search || undefined,
      })
      setBooks(result.items)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, reviewFilter, search])

  const poll = useCallback(async () => {
    try {
      const result = await listBooks({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter,
        review: reviewFilter || undefined,
        search: search || undefined,
      })
      setBooks(result.items)
      setTotal(result.total)
    } catch {
      // Ignore silent poll errors
    }
  }, [page, statusFilter, reviewFilter, search])

  useEffect(() => { load() }, [load])

  // If navigated here with { state: { editBookId } } (e.g. from the duplicate
  // ISBN flow in LookupStep), open that book's edit view on mount and clear
  // the location state so a browser refresh doesn't re-trigger it.
  useEffect(() => {
    const state = location.state as { editBookId?: string } | null
    if (!state?.editBookId) return
    const id = state.editBookId
    navigate(location.pathname, { replace: true, state: null })
    getBook(id).then((book) => setEditingBook(book)).catch(() => {})
    // Only on mount / when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

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
    getExportBatch().then(setExportBatch).catch(() => {})
  }, [])

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

  async function handleRegenerate() {
    if (!editingBook || regenerating) return
    setRegenerating(true)
    try {
      const { description } = await generateSummary({
        title: editingBook.title,
        author: editingBook.author,
        year: editingBook.year,
        publisher: editingBook.publisher,
      })
      if (description) {
        await handleImmediateSave({
          description,
          description_source: 'ai_generated',
          needs_description_review: true,
        })
      }
    } catch {
      // Silently swallow — user can retry the regenerate button
    } finally {
      setRegenerating(false)
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

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportBooks()
      const batch = await getExportBatch()
      setExportBatch(batch)
      load()
    } catch {
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleUndo = async () => {
    try {
      await undoExportBatch()
      setExportBatch(null)
      load()
    } catch {
      alert('Undo failed')
    }
  }

  const handleDismiss = async () => {
    try {
      await dismissExportBatch()
      setExportBatch(null)
    } catch {}
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (editingBook) {
    const secondaryButtonStyle: React.CSSProperties = {
      flex: 1,
      height: 44,
      fontSize: 13,
      fontWeight: 500,
      border: `1px solid ${theme.colors.zoneBorder}`,
      borderRadius: theme.radius.md,
      background: theme.colors.bg,
      color: theme.colors.secondaryText,
      cursor: 'pointer',
      fontFamily: theme.font.sans,
    }

    return (
      <>
        {/* Viewport-pinned shell: navbar + scroll zone + footer */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            maxWidth: '100vw',
            height: vpHeight,
            transform: `translateY(${vpOffset}px)`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            overscrollBehavior: 'none',
            background: theme.colors.bg,
            color: theme.colors.text,
            fontFamily: theme.font.sans,
          }}
        >
          {/* Navbar */}
          <div
            style={{
              flexShrink: 0,
              background: theme.colors.navBg,
              borderBottom: `1px solid ${theme.colors.zoneBorder}`,
            }}
          >
            <div
              style={{
                maxWidth: 1200,
                margin: '0 auto',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
                  BookScan
                </h1>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: theme.colors.muted }}>
                  {total} book{total !== 1 ? 's' : ''}
                </p>
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: theme.colors.text,
                  textAlign: 'center',
                  flex: 'none',
                }}
              >
                Edit Book
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={logout}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.85rem',
                    border: `1px solid ${theme.colors.zoneBorder}`,
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
          </div>

          {/* Scrollable content zone */}
          <div
            className="mobile-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overscrollBehavior: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                maxWidth: 1200,
                margin: '0 auto',
                padding: '1rem 1.25rem',
                minHeight: '100%',
                background: theme.colors.bg,
                borderLeft: `1px solid ${theme.colors.zoneBorder}`,
                borderRight: `1px solid ${theme.colors.zoneBorder}`,
                boxSizing: 'border-box',
              }}
            >
              <BookCard
                ref={bookCardRef}
                editable
                book={editingBook}
                photos={bookPhotos.map((p) => ({ key: p.id, url: photoUrls[p.id] ?? '' }))}
                photoUrls={photoUrls}
                onDeletePhoto={handleDeletePhoto}
                onAddPhoto={handleAddPhoto}
                onSave={handleSave}
                onImmediateSave={handleImmediateSave}
                onRegenerateDescription={handleRegenerate}
                regeneratingDescription={regenerating}
                showListingFields={!isMobileDevice()}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              flexShrink: 0,
              background: theme.colors.navBg,
              borderTop: `1px solid ${theme.colors.zoneBorder}`,
              padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await bookCardRef.current?.commitDraft()
                      setEditingBook(null)
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Save failed')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  style={{
                    width: '100%',
                    height: 44,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    border: 'none',
                    borderRadius: theme.radius.md,
                    background: saving ? theme.colors.disabled : theme.colors.primaryBlue,
                    color: '#fff',
                    cursor: saving ? 'default' : 'pointer',
                    fontFamily: theme.font.sans,
                  }}
                >
                  {saving ? 'SAVING…' : 'SAVE'}
                </button>
                <button type="button" onClick={() => setEditingBook(null)} style={{
                  ...secondaryButtonStyle,
                  flex: undefined,
                  width: '100%',
                }}>
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        maxWidth: '100vw',
        height: vpHeight,
        transform: `translateY(${vpOffset}px)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        background: theme.colors.bg,
        fontFamily: theme.font.sans,
      }}
    >
      {/* Navbar */}
      <div style={{ flexShrink: 0, background: theme.colors.navBg }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              BookScan
            </h1>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: theme.colors.secondaryText }}>
              {total} book{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isMobileDevice() ? (
              <button
                aria-label="Scan books"
                onClick={() => navigate('/scan')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.4rem 0.5rem',
                  border: `1px solid ${theme.colors.zoneBorder}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.bg,
                  cursor: 'pointer',
                  color: theme.colors.text,
                }}
              >
                <Camera size={18} />
              </button>
            ) : (
              <button
                onClick={() => exportListingsCSV().catch(() => alert('Export failed'))}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  border: `1px solid ${theme.colors.zoneBorder}`,
                  borderRadius: theme.radius.sm,
                  background: theme.colors.bg,
                  color: theme.colors.secondaryText,
                  cursor: 'pointer',
                  fontFamily: theme.font.sans,
                }}
              >
                CSV
              </button>
            )}
            <button
              onClick={logout}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                border: `1px solid ${theme.colors.zoneBorder}`,
                borderRadius: theme.radius.sm,
                background: theme.colors.bg,
                color: theme.colors.secondaryText,
                cursor: 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Content zone — scrolls between pinned navbar and footer */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            background: theme.colors.bg,
            borderLeft: `1px solid ${theme.colors.zoneBorder}`,
            borderRight: `1px solid ${theme.colors.zoneBorder}`,
            padding: '1.25rem 1.5rem',
            minHeight: '100%',
            boxSizing: 'border-box',
          }}
        >
          {exportBatch && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                marginBottom: '1rem',
                background: theme.colors.filterGreenFill,
                border: `1px solid ${theme.colors.reviewGreen}`,
                borderRadius: theme.radius.sm,
                fontSize: '0.85rem',
                color: theme.colors.text,
              }}
            >
              <span>
                ✓ {exportBatch.count} record{exportBatch.count !== 1 ? 's' : ''} exported and archived.
              </span>
              <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={handleUndo}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8rem',
                    border: `1px solid ${theme.colors.zoneBorder}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.bg,
                    color: theme.colors.secondaryText,
                    cursor: 'pointer',
                    fontFamily: theme.font.sans,
                  }}
                >
                  Undo
                </button>
                <button
                  onClick={handleDismiss}
                  aria-label="Dismiss"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.2rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: theme.colors.muted,
                  }}
                >
                  <X size={16} />
                </button>
              </span>
            </div>
          )}

          {/* Search / filter row */}
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
                border: `1px solid ${theme.colors.zoneBorder}`,
                borderRadius: theme.radius.sm,
                fontFamily: theme.font.sans,
                outline: 'none',
              }}
            />
            <StatusTagFilter
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
            />
            <ReviewEyeFilter
              value={reviewFilter}
              onChange={(v) => { setReviewFilter(v); setPage(1) }}
            />
            {statusFilter === 'ready' && !isMobileDevice() && (
              <button
                disabled={total === 0 || exporting}
                onClick={handleExport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  border: `1px solid ${theme.colors.zoneBorder}`,
                  borderRadius: theme.radius.sm,
                  background: total === 0 || exporting ? theme.colors.disabled : theme.colors.bg,
                  color: total === 0 || exporting ? theme.colors.muted : theme.colors.secondaryText,
                  cursor: total === 0 || exporting ? 'default' : 'pointer',
                  fontFamily: theme.font.sans,
                  whiteSpace: 'nowrap',
                  opacity: total === 0 || exporting ? 0.5 : 1,
                }}
              >
                <Download size={14} />
                {exporting ? 'Exporting...' : `Export ${total} (CSV + photos)`}
              </button>
            )}
          </div>

          {loading ? (
            <p style={{ color: theme.colors.muted, fontSize: '0.9rem' }}>Loading…</p>
          ) : (
            <BookTable
              books={books}
              onEdit={(b) => setEditingBook(b)}
              onDelete={handleDelete}
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
                  border: `1px solid ${theme.colors.zoneBorder}`,
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
                  border: `1px solid ${theme.colors.zoneBorder}`,
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
        </div>
      </div>

      {/* Footer bar */}
      <div
        style={{
          flexShrink: 0,
          background: theme.colors.navBg,
          borderTop: `1px solid ${theme.colors.zoneBorder}`,
          padding: '0.75rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: theme.colors.secondaryText,
        }}
      >
        {books.length} of {total} records
        {statusFilter !== 'all' && (
          <> &middot; Status: {statusFilter === 'ready' ? 'Ready to list' : 'Archived'}</>
        )}
        {reviewFilter && (
          <> &middot; Review: {
            reviewFilter === 'needs_metadata_review' ? 'Metadata' :
            reviewFilter === 'needs_photo_review' ? 'Photography' :
            reviewFilter === 'needs_description_review' ? 'Description' :
            'Price'
          }</>
        )}
        {statusFilter === 'all' && !reviewFilter && ''}
      </div>

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
