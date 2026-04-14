import { render, screen, fireEvent } from '@testing-library/react'
import BookEditCard from '../components/BookEditCard'
import { Book } from '../types'

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
    needs_metadata_review: false,
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
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByText('Refactoring')).toBeInTheDocument()
    expect(screen.getByText('Martin Fowler')).toBeInTheDocument()
  })

  it('renders condition segmented bar with all five options', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Very Good' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acceptable' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Poor' })).toBeInTheDocument()
  })

  it('clicking a condition button calls onImmediateSave with that value', () => {
    const onImmediateSave = vi.fn().mockResolvedValue(undefined)
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={onImmediateSave}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(onImmediateSave).toHaveBeenCalledWith({ condition: 'New' })
  })

  it('Review Metadata toggle reflects needs_metadata_review=true via aria-pressed', () => {
    render(
      <BookEditCard
        book={makeBook({ needs_metadata_review: true })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: /review metadata/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('Review Photography toggle reflects needs_photo_review=true via aria-pressed', () => {
    render(
      <BookEditCard
        book={makeBook({ needs_photo_review: true })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: /review photography/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onImmediateSave with needs_metadata_review true when Review Metadata toggle is clicked', () => {
    const onImmediateSave = vi.fn().mockResolvedValue(undefined)
    render(
      <BookEditCard
        book={makeBook({ needs_metadata_review: false })}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={onImmediateSave}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /review metadata/i }))
    expect(onImmediateSave).toHaveBeenCalledWith({ needs_metadata_review: true })
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
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders Dashboard, Generate Listing and Save buttons', () => {
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate listing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('Dashboard button calls onBack', () => {
    const onBack = vi.fn()
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onBack={onBack}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /dashboard/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('Generate Listing button calls onGenerateListing', () => {
    const onGenerateListing = vi.fn()
    render(
      <BookEditCard
        book={makeBook()}
        photos={[]}
        photoUrls={{}}
        onDeletePhoto={noOp}
        onAddPhoto={noOp}
        onSave={noOp}
        onImmediateSave={noOp}
        onBack={vi.fn()}
        totalCount={0}
        onLogout={vi.fn()}
        onGenerateListing={onGenerateListing}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /generate listing/i }))
    expect(onGenerateListing).toHaveBeenCalled()
  })
})
