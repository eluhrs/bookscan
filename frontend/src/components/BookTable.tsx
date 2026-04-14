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
}

const iconButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.25rem 0.35rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export default function BookTable({ books, onEdit, onDelete }: BookTableProps) {
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
          background: theme.colors.tableHeaderBg,
        }}
        aria-sort={ariaSort}
      >
        {label}<span aria-hidden="true">{arrow}</span>
      </th>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <style>{`
  @media (max-width: 767px) {
    .bt-col-author,
    .bt-col-publisher,
    .bt-col-year { display: none !important; }
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
          <tr style={{ borderBottom: `1px solid ${theme.colors.navBg}`, background: theme.colors.tableHeaderBg }}>
            <th
              style={{
                padding: '0.6rem 0.5rem',
                width: 56,
                fontWeight: 500,
                fontSize: '0.8rem',
                color: theme.colors.muted,
                letterSpacing: '0.04em',
                textAlign: 'center',
                background: theme.colors.tableHeaderBg,
              }}
            >
              review
            </th>
            {colHeader('title', 'title')}
            {colHeader('author', 'author', 'bt-col-author')}
            {colHeader('publisher', 'publisher', 'bt-col-publisher')}
            {colHeader('year', 'year', 'bt-col-year')}
            <th
              style={{
                padding: '0.6rem 0.75rem',
                fontWeight: 500,
                fontSize: '0.8rem',
                color: theme.colors.muted,
                letterSpacing: '0.04em',
                textAlign: 'right',
                background: theme.colors.tableHeaderBg,
              }}
            >
              actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((book) => (
            <tr
              key={book.id}
              onClick={() => onEdit(book)}
              style={{ background: theme.colors.bg, borderBottom: `1px solid ${theme.colors.rowBorder}`, cursor: 'pointer' }}
            >
              <td style={{ padding: '0.6rem 0.5rem', width: 56, textAlign: 'center' }}>
                {!book.needs_metadata_review && !book.needs_photo_review ? (
                  <span title="Reviewed" style={{ display: 'inline-flex' }}>
                    <Check size={16} color={theme.colors.reviewGreen} />
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {book.needs_metadata_review && (
                      <span title="Metadata needs review" style={{ display: 'inline-flex' }}>
                        <FileWarning size={16} color={theme.colors.warning} />
                      </span>
                    )}
                    {book.needs_photo_review && (
                      <span title="Photography needs review" style={{ display: 'inline-flex' }}>
                        <CameraIcon size={16} color={theme.colors.accent} />
                      </span>
                    )}
                  </span>
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
              <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap', width: 1, textAlign: 'right' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(book) }}
                  aria-label="Edit book"
                  style={iconButtonStyle}
                >
                  <Pencil size={16} color="#888" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(book.id) }}
                  aria-label="Delete book"
                  style={iconButtonStyle}
                >
                  <Trash2 size={16} color="#888" />
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
