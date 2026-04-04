import { render, screen, fireEvent } from '@testing-library/react'
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
  subject: null,
  description: null,
  cover_image_url: null,
  cover_image_local: null,
  data_sources: null,
  data_complete: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('BookTable', () => {
  it('renders book rows', () => {
    const books = [makeBook({ title: 'Alpha' }), makeBook({ title: 'Beta' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} onGenerateListing={vi.fn()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('sorts by title ascending', () => {
    const books = [makeBook({ title: 'Zebra' }), makeBook({ title: 'Apple' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} onGenerateListing={vi.fn()} />)
    fireEvent.click(screen.getByText('Title'))
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Apple')
    expect(rows[2]).toHaveTextContent('Zebra')
  })

  it('shows incomplete badge for books missing data', () => {
    const books = [makeBook({ data_complete: false, title: 'Incomplete Book' })]
    render(<BookTable books={books} onEdit={vi.fn()} onDelete={vi.fn()} onGenerateListing={vi.fn()} />)
    expect(screen.getByText('Incomplete Book')).toBeInTheDocument()
    expect(screen.getByTitle('Incomplete data')).toBeInTheDocument()
  })
})
