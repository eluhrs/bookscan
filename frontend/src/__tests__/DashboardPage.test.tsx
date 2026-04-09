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

const mockIsMobileDevice = vi.fn()
vi.mock('../utils/deviceDetect', () => ({
  isMobileDevice: () => mockIsMobileDevice(),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('DashboardPage scan link', () => {
  afterEach(() => {
    mockIsMobileDevice.mockReset()
  })

  it('shows scan button on mobile', () => {
    mockIsMobileDevice.mockReturnValue(true)
    render(<DashboardPage />, { wrapper })
    expect(screen.getByRole('button', { name: /scan books/i })).toBeInTheDocument()
  })

  it('hides scan button on desktop', () => {
    mockIsMobileDevice.mockReturnValue(false)
    render(<DashboardPage />, { wrapper })
    expect(screen.queryByRole('button', { name: /scan books/i })).not.toBeInTheDocument()
  })
})
