import { useState } from 'react'
import { Book } from '../types'

type SortKey = 'title' | 'author' | 'year' | 'publisher' | 'created_at'
type SortDir = 'asc' | 'desc'

interface BookTableProps {
  books: Book[]
  onEdit: (book: Book) => void
  onDelete: (id: Book['id']) => void
  onGenerateListing: (book: Book) => void
}

export default function BookTable({ books, onEdit, onDelete, onGenerateListing }: BookTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...books].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  function colHeader(label: string, key: SortKey) {
    const arrow = sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
    const ariaSort = sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
    return (
      <th
        onClick={() => handleSort(key)}
        style={{ cursor: 'pointer', textAlign: 'left', padding: '0.5rem', userSelect: 'none' }}
        aria-sort={ariaSort}
      >
        {label}<span aria-hidden="true">{arrow}</span>
      </th>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
            <th style={{ padding: '0.5rem' }}></th>
            {colHeader('Title', 'title')}
            {colHeader('Author', 'author')}
            {colHeader('Publisher', 'publisher')}
            {colHeader('Year', 'year')}
            <th style={{ padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((book) => (
            <tr key={book.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', width: 24 }}>
                {!book.data_complete && (
                  <span title="Incomplete data" style={{ color: 'orange', fontSize: '1rem' }}>
                    ⚠
                  </span>
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{book.title ?? '—'}</td>
              <td style={{ padding: '0.5rem' }}>{book.author ?? '—'}</td>
              <td style={{ padding: '0.5rem' }}>{book.publisher ?? '—'}</td>
              <td style={{ padding: '0.5rem' }}>{book.year ?? '—'}</td>
              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                <button onClick={() => onGenerateListing(book)} style={{ marginRight: '0.25rem' }}>
                  List
                </button>
                <button onClick={() => onEdit(book)} style={{ marginRight: '0.25rem' }}>
                  Edit
                </button>
                <button
                  onClick={() => { if (window.confirm(`Delete "${book.title ?? book.isbn}"?`)) onDelete(book.id) }}
                  style={{ color: 'red' }}
                  aria-label="Delete book"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                No books yet. Scan some on your phone!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
