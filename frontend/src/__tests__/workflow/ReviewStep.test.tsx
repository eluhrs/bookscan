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
  subject: null,
  description: null,
  condition: null,
  cover_image_url: null,
  data_sources: null,
  data_complete: true,
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

  it('flag for review is unchecked when data_complete is true', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, data_complete: true }} />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /Mark for Review/ })).not.toBeChecked()
  })

  it('flag for review is pre-checked when data_complete is false', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, data_complete: false }} />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /Mark for Review/ })).toBeChecked()
  })

  it('user can override the flag for review checkbox', () => {
    render(<ReviewStep {...defaultProps} lookupResult={{ ...baseLookup, data_complete: false }} />, { wrapper })
    const checkbox = screen.getByRole('checkbox', { name: /Mark for Review/ })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('displays title and author from lookup result', () => {
    render(<ReviewStep {...defaultProps} />, { wrapper })
    expect(screen.getByText('Test Book')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
  })
})
