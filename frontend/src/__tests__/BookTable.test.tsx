import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BookTable from '../components/BookTable'
import { Book } from '../types'

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: crypto.randomUUID(),
  isbn: '9781234567890',
  title: 'Test Book',
  author: 'Test Author',
  publisher: 'Test Publisher',
  edition: null,
  year: 2020,
  pages: 200,
  dimensions: null,
  weight: null,
  description: null,
  condition: null,
  cover_image_url: null,
  cover_image_local: null,
  data_sources: null,
  needs_metadata_review: false,
  has_photos: false,
  needs_photo_review: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('BookTable', () => {
  it('renders book rows', () => {
    const books = [makeBook({ title: 'Alpha' }), makeBook({ title: 'Beta' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('sorts by title ascending', () => {
    const books = [makeBook({ title: 'Zebra' }), makeBook({ title: 'Apple' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('title'))
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Apple')
    expect(rows[2]).toHaveTextContent('Zebra')
  })

  it('shows incomplete badge for books missing data', () => {
    const books = [makeBook({ needs_metadata_review: true, title: 'Incomplete Book' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Incomplete Book')).toBeInTheDocument()
    expect(screen.getByTitle('Metadata needs review')).toBeInTheDocument()
  })

  it('calls onDelete immediately when delete button is clicked', () => {
    const onDelete = vi.fn()
    const book = makeBook({ title: 'Delete Me' })
    render(<BookTable books={[book]} onEdit={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getAllByLabelText('Delete book')[0])
    expect(onDelete).toHaveBeenCalledWith(book.id)
  })

  it('shows photo review indicator when needs_photo_review is true', () => {
    const books = [makeBook({ needs_photo_review: true, title: 'Needs Photos Book' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByTitle('Photography needs review')).toBeInTheDocument()
  })

  it('does not show photo review indicator when needs_photo_review is false', () => {
    const books = [makeBook({ needs_photo_review: false, title: 'Has Photos Book' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByTitle('Photography needs review')).not.toBeInTheDocument()
  })

  it('title cell has two-line clamp and overflow hidden', () => {
    const books = [makeBook({ title: 'Test Book' })]
    const { container } = render(
      <BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    const rows = container.querySelectorAll('tbody tr')
    const titleTd = rows[0].querySelectorAll('td')[1] as HTMLElement
    expect(titleTd.style.overflow).toBe('hidden')
    expect(titleTd.style.maxWidth).toBeTruthy()
  })

  it('author cell has one-line ellipsis styles', () => {
    const books = [makeBook({ author: 'Test Author' })]
    const { container } = render(
      <BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    const rows = container.querySelectorAll('tbody tr')
    const authorTd = rows[0].querySelectorAll('td')[2] as HTMLElement
    expect(authorTd.style.overflow).toBe('hidden')
    expect(authorTd.style.textOverflow).toBe('ellipsis')
    expect(authorTd.style.whiteSpace).toBe('nowrap')
  })

  it('does not render a List/Listing button', () => {
    const books = [makeBook({ title: 'Some Book' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('List')).not.toBeInTheDocument()
    expect(screen.queryByText('Listing')).not.toBeInTheDocument()
  })

  it('shows green check when neither review flag is set', () => {
    const books = [makeBook({ needs_metadata_review: false, needs_photo_review: false })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByTitle('Reviewed')).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    const book = makeBook({ title: 'Edit Me' })
    render(<BookTable books={[book]} onEdit={onEdit} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Edit book'))
    expect(onEdit).toHaveBeenCalledWith(book)
  })
})
