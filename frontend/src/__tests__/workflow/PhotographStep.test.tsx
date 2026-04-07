import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PhotographStep from '../../components/workflow/PhotographStep'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

const defaultProps = {
  photos: [] as File[],
  targetCount: 3,
  onTargetCountChange: vi.fn(),
  onPhotoAdded: vi.fn(),
  onCancel: vi.fn(),
}

describe('PhotographStep', () => {
  it('renders select with options 1–5', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(5)
    expect(options.map((o) => o.textContent)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('shows current capture count out of target', () => {
    const photos = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')]
    render(<PhotographStep {...defaultProps} photos={photos} targetCount={3} />, { wrapper })
    expect(screen.getByText('2 / 3 captured')).toBeInTheDocument()
  })

  it('calls onTargetCountChange when select value changes', () => {
    const onTargetCountChange = vi.fn()
    render(
      <PhotographStep {...defaultProps} onTargetCountChange={onTargetCountChange} />,
      { wrapper }
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } })
    expect(onTargetCountChange).toHaveBeenCalledWith(5)
  })

  it('calls onPhotoAdded when a file is selected via the hidden input', () => {
    const onPhotoAdded = vi.fn()
    render(
      <PhotographStep {...defaultProps} onPhotoAdded={onPhotoAdded} />,
      { wrapper }
    )
    const file = new File(['fake image'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(onPhotoAdded).toHaveBeenCalledWith(file)
  })

  it('renders thumbnails for each captured photo', () => {
    // jsdom can't decode blob URLs, but we verify the img count
    const photos = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')]
    render(<PhotographStep {...defaultProps} photos={photos} />, { wrapper })
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('primary button label is CAPTURE', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    expect(screen.getByRole('button', { name: 'CAPTURE' })).toBeInTheDocument()
  })
})
