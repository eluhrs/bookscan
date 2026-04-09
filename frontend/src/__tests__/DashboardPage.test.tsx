import { render, screen } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

vi.mock('../api/books', () => ({
  listBooks: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  exportListingsCSV: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
}))
vi.mock('../api/photos', () => ({
  listPhotos: vi.fn().mockResolvedValue([]),
  deletePhoto: vi.fn(),
  getPhotoUrl: vi.fn(),
}))
vi.mock('../api/listings', () => ({
  generateListing: vi.fn(),
  getBookListings: vi.fn().mockResolvedValue([]),
  getAllListings: vi.fn().mockResolvedValue([]),
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('DashboardPage scan link', () => {
  const originalWidth = window.innerWidth

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
  })

  it('shows scan button on mobile (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    render(<DashboardPage />, { wrapper })
    expect(screen.getByRole('button', { name: /scan books/i })).toBeInTheDocument()
  })

  it('hides scan button on desktop (>= 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    render(<DashboardPage />, { wrapper })
    expect(screen.queryByRole('button', { name: /scan books/i })).not.toBeInTheDocument()
  })
})
