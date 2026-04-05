import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import BookTable from '../components/BookTable'
import BookForm from '../components/BookForm'
import ListingGenerator from '../components/ListingGenerator'
import { listBooks, updateBook, deleteBook, exportListingsCSV } from '../api/books'
import { Book, BookLookup } from '../types'
import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { logout } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [listingBook, setListingBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(false)
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

  useEffect(() => { load() }, [load])

  async function handleEdit(updated: BookLookup) {
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
        data_complete: updated.data_complete,
      })
      setEditingBook(null)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this book?')) return
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
      <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
        <h2>Edit Book</h2>
        <BookForm initial={asLookup} onSave={handleEdit} onCancel={() => setEditingBook(null)} />
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>BookScan — {total} books</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/scan" style={{ fontSize: '0.9rem' }}>📱 Scan</Link>
          <button onClick={logout}>Log out</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search title, author, ISBN…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 200, padding: '0.4rem' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => { setIncompleteOnly(e.target.checked); setPage(1) }}
          />
          Incomplete only
        </label>
        <button
          onClick={() => exportListingsCSV().catch(() => alert('Export failed'))}
          style={{ padding: '0.4rem 0.75rem', background: '#eee', borderRadius: 4, border: 'none', cursor: 'pointer' }}
        >
          Export CSV
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <BookTable
          books={books}
          onEdit={(b) => setEditingBook(b)}
          onDelete={handleDelete}
          onGenerateListing={(b) => setListingBook(b)}
        />
      )}

      {totalPages > 1 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {listingBook && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          overflowY: 'auto', padding: '2rem'
        }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 640, padding: '1rem' }}>
            <ListingGenerator book={listingBook} onClose={() => setListingBook(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
