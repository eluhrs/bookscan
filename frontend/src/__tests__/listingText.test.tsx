import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ListingGenerator from '../components/ListingGenerator'

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
  subject: null,
  description: null,
  cover_image_url: null,
  cover_image_local: null,
  data_sources: null,
  data_complete: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

vi.mock('../api/listings', () => ({
  generateListing: vi.fn().mockResolvedValue({
    id: 'listing-1',
    book_id: '123',
    listing_text: 'TITLE: Test Book by Test Author\nCONDITION: Used',
    created_at: new Date().toISOString(),
    ebay_listing_id: null,
    ebay_status: 'draft',
  }),
  getBookListings: vi.fn().mockResolvedValue([]),
}))

describe('ListingGenerator', () => {
  it('shows generate button', () => {
    render(<ListingGenerator book={mockBook} onClose={vi.fn()} />)
    expect(screen.getByText('Generate Listing')).toBeInTheDocument()
  })

  it('shows listing text after generate', async () => {
    render(<ListingGenerator book={mockBook} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Generate Listing'))
    await waitFor(() => screen.getByText(/TITLE: Test Book by Test Author/))
    expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument()
  })
})
