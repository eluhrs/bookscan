import { useState } from 'react'
import { FileWarning, Camera as CameraIcon, Pencil, Trash2, Check } from 'lucide-react'
import { Book } from '../types'
import { theme } from '../styles/theme'

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

  function colHeader(label: string, key: SortKey, className?: string) {
    const arrow = sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
    const ariaSort = sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
    return (
      <th
        className={className}
        onClick={() => handleSort(key)}
        style={{
          cursor: 'pointer',
          textAlign: 'left',
          padding: '0.6rem 0.75rem',
          userSelect: 'none',
          fontWeight: 500,
          fontSize: '0.8rem',
          color: theme.colors.muted,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
        aria-sort={ariaSort}
      >
        {label}<span aria-hidden="true">{arrow}</span>
      </th>
    )
  }

  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md }}>
      <style>{`
  @media (max-width: 767px) {
    .bt-col-author,
    .bt-col-publisher,
    .bt-col-year { display: none !important; }
    .bt-col-actions-text { display: none !important; }
    .bt-col-actions-icon { display: table-cell !important; }
  }
  @media (min-width: 768px) {
    .bt-col-actions-text { display: table-cell !important; }
    .bt-col-actions-icon { display: none !important; }
  }
`}</style>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
          fontFamily: theme.font.sans,
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.zoneBg }}>
            <th
              style={{
                padding: '0.6rem 0.5rem',
                width: 48,
                fontWeight: 500,
                fontSize: '0.8rem',
                color: theme.colors.muted,
                letterSpacing: '0.04em',
                textAlign: 'left',
              }}
            >
              review
            </th>
            {colHeader('title', 'title')}
            {colHeader('author', 'author', 'bt-col-author')}
            {colHeader('publisher', 'publisher', 'bt-col-publisher')}
            {colHeader('year', 'year', 'bt-col-year')}
            <th
              className="bt-col-actions-text"
              style={{
                padding: '0.6rem 0.75rem',
                fontWeight: 500,
                fontSize: '0.8rem',
                color: theme.colors.muted,
                letterSpacing: '0.04em',
              }}
            >
              actions
            </th>
            <th className="bt-col-actions-icon" style={{ display: 'none', padding: '0.6rem 0.5rem', width: 72 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((book) => (
            <tr
              key={book.id}
              onClick={() => onEdit(book)}
              style={{ borderBottom: `1px solid ${theme.colors.border}`, cursor: 'pointer' }}
            >
              <td style={{ padding: '0.6rem 0.5rem', width: 48 }}>
                {book.data_complete && !book.needs_photo_review ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40 }}>
                    <span title="Reviewed" style={{ display: 'flex' }}>
                      <Check size={16} color={theme.colors.scanGreen} />
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!book.data_complete && (
                        <span title="Metadata needs review" style={{ display: 'flex' }}>
                          <FileWarning size={16} color={theme.colors.warning} />
                        </span>
                      )}
                    </div>
                    <div style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {book.needs_photo_review && (
                        <span title="Photography needs review" style={{ display: 'flex' }}>
                          <CameraIcon size={16} color={theme.colors.accent} />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </td>
              <td
                style={{
                  padding: '0.6rem 0.75rem',
                  fontWeight: 500,
                  maxWidth: 220,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.4,
                }}
              >
                {book.title ?? '—'}
              </td>
              <td
                className="bt-col-author"
                style={{
                  padding: '0.6rem 0.75rem',
                  color: theme.colors.muted,
                  maxWidth: 160,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {book.author ?? '—'}
              </td>
              <td
                className="bt-col-publisher"
                style={{
                  padding: '0.6rem 0.75rem',
                  color: theme.colors.muted,
                  maxWidth: 180,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {book.publisher ?? '—'}
              </td>
              <td
                className="bt-col-year"
                style={{
                  padding: '0.6rem 0.75rem',
                  color: theme.colors.muted,
                  fontFamily: theme.font.mono,
                  fontSize: '0.85rem',
                }}
              >
                {book.year ?? '—'}
              </td>
              <td className="bt-col-actions-text" style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerateListing(book) }}
                  style={{
                    marginRight: '0.4rem',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.bg,
                    cursor: 'pointer',
                  }}
                >
                  List
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(book) }}
                  style={{
                    marginRight: '0.4rem',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.bg,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(book.id) }}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    border: `1px solid ${theme.colors.danger}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.bg,
                    color: theme.colors.danger,
                    cursor: 'pointer',
                  }}
                  aria-label="Delete book"
                >
                  Delete
                </button>
              </td>
              <td className="bt-col-actions-icon" style={{ display: 'none', padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(book) }}
                  style={{
                    marginRight: '0.5rem',
                    padding: '0.35rem',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.bg,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Edit book"
                >
                  <Pencil size={16} color={theme.colors.muted} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(book.id) }}
                  style={{
                    padding: '0.35rem',
                    border: `1px solid ${theme.colors.danger}`,
                    borderRadius: theme.radius.sm,
                    background: theme.colors.bg,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Delete book"
                >
                  <Trash2 size={16} color={theme.colors.danger} />
                </button>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={99}
                style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: theme.colors.muted,
                  fontSize: '0.9rem',
                }}
              >
                No books yet. Scan some on your phone!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
