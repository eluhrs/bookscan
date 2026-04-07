import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PhotographStep from '../../components/workflow/PhotographStep'

vi.mock('../../hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    torchAvailable: false,
    torchOn: false,
    cameraError: null,
    handleTorchToggle: vi.fn(),
  }),
}))

vi.mock('../../hooks/useScanAudio', () => ({
  useScanAudio: () => ({
    playSuccess: vi.fn(),
    playReview: vi.fn(),
  }),
}))

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

  it('shows □/■ progress indicators matching photo count', () => {
    const photos = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')]
    render(<PhotographStep {...defaultProps} photos={photos} targetCount={3} />, { wrapper })
    // 2 filled (■) and 1 empty (□)
    const squares = screen.getAllByText(/[■□]/)
    expect(squares.filter((s) => s.textContent === '■')).toHaveLength(2)
    expect(squares.filter((s) => s.textContent === '□')).toHaveLength(1)
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

  it('CAPTURE button is present and enabled when no camera error', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    const captureBtn = screen.getByRole('button', { name: 'CAPTURE' })
    expect(captureBtn).toBeInTheDocument()
    expect(captureBtn).not.toBeDisabled()
  })

  it('shows dynamic hint text for current photo position', () => {
    const { rerender } = render(<PhotographStep {...defaultProps} photos={[]} />, { wrapper })
    expect(screen.getByText('Position front cover')).toBeInTheDocument()

    rerender(<PhotographStep {...defaultProps} photos={[new File(['a'], 'a.jpg')]} />)
    expect(screen.getByText('Position back cover')).toBeInTheDocument()
  })

  it('primary button label is CAPTURE', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    expect(screen.getByRole('button', { name: 'CAPTURE' })).toBeInTheDocument()
  })
})
