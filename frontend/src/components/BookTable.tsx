import { useState } from 'react'
import { FileWarning, Camera as CameraIcon } from 'lucide-react'
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

const CONDITION_COLOR: Record<string, string> = {
  'New':       theme.colors.accent,
  'Very Good': '#16A34A',
  'Good':      '#D97706',
  'Acceptable': theme.colors.muted,
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
        style={{
          cursor: 'pointer',
          textAlign: 'left',
          padding: '0.6rem 0.75rem',
          userSelect: 'none',
          fontWeight: 500,
          fontSize: '0.8rem',
          color: theme.colors.muted,
          textTransform: 'uppercase',
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
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
          fontFamily: theme.font.sans,
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
            <th style={{ padding: '0.6rem 0.5rem', width: 48 }} />
            {colHeader('Title', 'title')}
            {colHeader('Author', 'author')}
            {colHeader('Publisher', 'publisher')}
            {colHeader('Year', 'year')}
            <th
              style={{
                padding: '0.6rem 0.75rem',
                fontWeight: 500,
                fontSize: '0.8rem',
                color: theme.colors.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Condition
            </th>
            <th
              style={{
                padding: '0.6rem 0.75rem',
                fontWeight: 500,
                fontSize: '0.8rem',
                color: theme.colors.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((book) => (
            <tr
              key={book.id}
              style={{ borderBottom: `1px solid ${theme.colors.border}` }}
            >
              <td style={{ padding: '0.6rem 0.5rem', width: 48 }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {/* Slot 1: metadata warning — FileWarning when data_complete is false */}
                  <div style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Metadata needs review">
                    {!book.data_complete && (
                      <FileWarning
                        size={16}
                        color={theme.colors.warning}
                      />
                    )}
                  </div>
                  {/* Slot 2: photography review — Camera when needs_photo_review is true */}
                  <div style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Photography needs review">
                    {book.needs_photo_review && (
                      <CameraIcon
                        size={16}
                        color={theme.colors.accent}
                      />
                    )}
                  </div>
                </div>
              </td>
              <td
                style={{
                  padding: '0.6rem 0.75rem',
                  fontWeight: 500,
                  maxWidth: 220,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.4,
                }}
              >
                {book.title ?? '—'}
              </td>
              <td
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
              <td style={{ padding: '0.6rem 0.75rem', color: theme.colors.muted }}>
                {book.publisher ?? '—'}
              </td>
              <td
                style={{
                  padding: '0.6rem 0.75rem',
                  color: theme.colors.muted,
                  fontFamily: theme.font.mono,
                  fontSize: '0.85rem',
                }}
              >
                {book.year ?? '—'}
              </td>
              <td style={{ padding: '0.6rem 0.75rem' }}>
                {book.condition ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: CONDITION_COLOR[book.condition] ?? theme.colors.muted,
                      border: `1px solid ${CONDITION_COLOR[book.condition] ?? theme.colors.border}`,
                      borderRadius: '999px',
                      padding: '0.15rem 0.55rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {book.condition}
                  </span>
                ) : (
                  <span style={{ color: theme.colors.border }}>—</span>
                )}
              </td>
              <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                <button
                  onClick={() => onGenerateListing(book)}
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
                  onClick={() => onEdit(book)}
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
                  onClick={() => onDelete(book.id)}
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
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={7}
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
