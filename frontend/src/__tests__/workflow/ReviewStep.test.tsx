import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReviewStep from '../../components/workflow/ReviewStep'
import { BookLookup } from '../../types'

const baseLookup: BookLookup = {
  isbn: '9781234567890',
  title: 'Test Book',
  author: 'Test Author',
  publisher: 'Test Publisher',
  edition: null,
  year: 2021,
  pages: null,
  dimensions: null,
  weight: null,
  description: null,
  condition: null,
  cover_image_url: null,
  data_sources: null,
  needs_metadata_review: false,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('ReviewStep', () => {
  const defaultProps = {
    lookupResult: baseLookup,
    photos: [] as File[],
    savedBookId: null as string | null,
    onSavedBookId: vi.fn(),
    onSaveComplete: vi.fn(),
    onCancel: vi.fn(),
    skippedPhotography: false,
    aiSummary: { status: 'idle' as const, text: null },
  }

  it('SAVE button is disabled before condition is selected', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    expect(screen.getByRole('button', { name: 'SAVE' })).toBeDisabled()
  })

  it('SAVE button is enabled after selecting a condition', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Good' }))
    expect(screen.getByRole('button', { name: 'SAVE' })).not.toBeDisabled()
  })

  it('all five condition options are rendered', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    ;['New', 'Very Good', 'Good', 'Acceptable', 'Poor'].forEach((c) => {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument()
    })
  })

  it('flag for review is unchecked when needs_metadata_review is false', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, needs_metadata_review: false }} />, { wrapper })
    expect(screen.getByRole('button', { name: /review metadata/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('flag for review is pre-checked when needs_metadata_review is true', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, needs_metadata_review: true }} />, { wrapper })
    expect(screen.getByRole('button', { name: /review metadata/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('user can override the flag for review checkbox', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, needs_metadata_review: true }} />, { wrapper })
    const button = screen.getByRole('button', { name: /review metadata/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('displays title and author from lookup result', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    expect(screen.getByText('Test Book')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })

  it('Review Photography checkbox is unchecked when skippedPhotography is false', () => {
    render(<ReviewStep {...defaultProps} skippedPhotography={false} />, { wrapper })
    expect(screen.getByRole('button', { name: /review photography/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Review Photography checkbox is pre-checked when skippedPhotography is true', () => {
    render(<ReviewStep {...defaultProps} skippedPhotography={true} />, { wrapper })
    expect(screen.getByRole('button', { name: /review photography/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('user can override the Review Photography checkbox', () => {
    render(<ReviewStep {...defaultProps} skippedPhotography={true} />, { wrapper })
    const button = screen.getByRole('button', { name: /review photography/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('filmstrip renders cover image when cover_image_url is provided', () => {
    const lookup = { ...baseLookup, cover_image_url: 'https://example.com/cover.jpg' }
    render(<ReviewStep {...defaultProps} lookupResult={lookup} />, { wrapper })
    const imgs = screen.getAllByRole('img')
    expect(imgs.some((img) => (img as HTMLImageElement).src.includes('example.com/cover.jpg'))).toBe(true)
  })

  it('filmstrip renders delete buttons for user photos', () => {
    const fakeFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    render(<ReviewStep {...defaultProps} photos={[fakeFile]} />, { wrapper })
    expect(screen.getByRole('button', { name: /delete photo/i })).toBeInTheDocument()
  })

  it('filmstrip renders one delete button per user photo', () => {
    const file1 = new File(['x'], 'photo1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['y'], 'photo2.jpg', { type: 'image/jpeg' })
    render(<ReviewStep {...defaultProps} photos={[file1, file2]} />, { wrapper })
    expect(screen.getAllByRole('button', { name: /delete photo/i })).toHaveLength(2)
  })

  it('deleting all user photos auto-checks Review Photography?', () => {
    const fakeFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    render(<ReviewStep {...defaultProps} photos={[fakeFile]} skippedPhotography={false} />, { wrapper })
    expect(screen.getByRole('button', { name: /review photography/i })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: /delete photo/i }))
    expect(screen.getByRole('button', { name: /review photography/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('deleting a photo when others remain does not auto-check Review Photography?', () => {
    const file1 = new File(['x'], 'photo1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['y'], 'photo2.jpg', { type: 'image/jpeg' })
    render(<ReviewStep {...defaultProps} photos={[file1, file2]} skippedPhotography={false} />, { wrapper })
    const deleteBtns = screen.getAllByRole('button', { name: /delete photo/i })
    fireEvent.click(deleteBtns[0])
    expect(screen.getByRole('button', { name: /review photography/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('user can manually re-check Review Photography? after auto-uncheck', () => {
    // Start with skippedPhotography true (auto-checked), then manually uncheck
    render(<ReviewStep {...defaultProps} skippedPhotography={true} />, { wrapper })
    const button = screen.getByRole('button', { name: /review photography/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})
