import { render, screen } from '@testing-library/react'
import BookForm from '../components/BookForm'
import { BookLookup } from '../types'

function makeBook(overrides: Partial<BookLookup> = {}): BookLookup {
  return {
    isbn: '9780000000001',
    title: 'Test Book',
    author: null,
    publisher: null,
    edition: null,
    year: null,
    pages: null,
    dimensions: null,
    weight: null,
    subject: null,
    description: null,
    cover_image_url: null,
    condition: null,
    data_sources: null,
    data_complete: true,
    ...overrides,
  }
}

describe('BookForm', () => {
  it('renders condition select with all options', () => {
    render(<BookForm initial={makeBook()} onSave={vi.fn()} onCancel={vi.fn()} />)
    const select = screen.getByRole('combobox')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'])
  })

  it('shows Retain Flag when data_complete is false', () => {
    render(<BookForm initial={makeBook({ data_complete: false })} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Retain Flag')).toBeInTheDocument()
  })

  it('hides Retain Flag when data_complete is true', () => {
    render(<BookForm initial={makeBook({ data_complete: true })} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText('Retain Flag')).not.toBeInTheDocument()
  })
})
