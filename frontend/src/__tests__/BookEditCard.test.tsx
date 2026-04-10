import { render, screen, fireEvent } from '@testing-library/react'
import BookEditCard from '../components/BookEditCard'
import { Book, BookPhoto } from '../types'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    isbn: '9780134757599',
    title: 'Refactoring',
    author: 'Martin Fowler',
    publisher: 'Addison-Wesley',
    edition: '2nd ed.',
    year: 2018,
    pages: 448,
    dimensions: null,
    weight: null,
    description: 'Improving the design of existing code.',
    condition: 'Good',
    cover_image_url: null,
    cover_image_local: null,
    data_sources: null,
    data_complete: true,
    has_photos: false,
    needs_photo_review: false,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

describe('BookEditCard', () => {
  const noOp = vi.fn().mockResolvedValue(undefined)

  it('renders title and author', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByText('Refactoring')).toBeInTheDocument()
    expect(screen.getByText('Martin Fowler')).toBeInTheDocument()
  })

  it('renders condition dropdown with all options', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const select = screen.getByRole('combobox')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['', 'New', 'Very Good', 'Good', 'Acceptable', 'Poor'])
  })

  it('Review Metadata checkbox reflects !data_complete', () => {
    render(
      <BookEditCard
        book={makeBook({ data_complete: false })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const checkbox = screen.getByLabelText('Review Metadata?') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('Review Photography checkbox reflects needs_photo_review', () => {
    render(
      <BookEditCard
        book={makeBook({ needs_photo_review: true })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const checkbox = screen.getByLabelText('Review Photography?') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('calls onImmediateSave with data_complete false when Review Metadata is checked', async () => {
    const onImmediateSave = vi.fn().mockResolvedValue(undefined)
    render(
      <BookEditCard
        book={makeBook({ data_complete: true })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={onImmediateSave}
        onGenerateListing={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText('Review Metadata?'))
    expect(onImmediateSave).toHaveBeenCalledWith({ data_complete: false })
  })

  it('shows em dash for empty description', () => {
    render(
      <BookEditCard
        book={makeBook({ description: null })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders Save Changes and Generate Listing buttons', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate listing/i })).toBeInTheDocument()
  })
})
