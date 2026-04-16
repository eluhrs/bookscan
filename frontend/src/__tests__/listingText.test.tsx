import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ListingGenerator from '../components/ListingGenerator'

vi.mock('../api/listings', () => ({
  generateListing: vi.fn().mockResolvedValue({
    id: 'listing-1',
    book_id: '123',
    listing_text: 'LISTING TITLE: Test Book by Test Author\nCONDITION: Used',
    created_at: new Date().toISOString(),
    ebay_listing_id: null,
    ebay_status: 'draft',
  }),
  getBookListings: vi.fn().mockResolvedValue([]),
}))

vi.mock('../api/photos', () => ({
  downloadPhotosZip: vi.fn().mockResolvedValue(undefined),
}))

const mockBook = {
  id: '123',
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
  description_source: null,
  needs_description_review: false,
  description_generation_failed: false,
  price: null,
  ebay_category_id: null,
  ebay_category_name: null,
  archived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('ListingGenerator', () => {
  it('shows generate button', () => {
    render(<ListingGenerator book={mockBook} onClose={vi.fn()} />)
    expect(screen.getByText('Generate Listing')).toBeInTheDocument()
  })

  it('shows listing text after generate', async () => {
    render(<ListingGenerator book={mockBook} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Generate Listing'))
    await waitFor(() => screen.getByText(/LISTING TITLE: Test Book by Test Author/))
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('shows description field when book has a description', () => {
    render(
      <ListingGenerator
        book={{ ...mockBook, description: 'A fascinating exploration of the subject.' }}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('A fascinating exploration of the subject.')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('does not show description field when book has no description', () => {
    render(<ListingGenerator book={mockBook} onClose={vi.fn()} />)
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })

  it('shows Download Photos button when book has photos', () => {
    render(<ListingGenerator book={{ ...mockBook, has_photos: true }} onClose={vi.fn()} />)
    expect(screen.getByText('Download Photos')).toBeInTheDocument()
  })

  it('does not show Download Photos button when book has no photos', () => {
    render(<ListingGenerator book={mockBook} onClose={vi.fn()} />)
    expect(screen.queryByText('Download Photos')).not.toBeInTheDocument()
  })
})
