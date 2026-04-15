import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PhotographStep from '../../components/workflow/PhotographStep'

beforeEach(() => {
  window.ResizeObserver = class ResizeObserver {
    private cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) { this.cb = cb }
    observe(_el: Element) {
      this.cb(
        [{ contentRect: { width: 300, height: 400 } } as ResizeObserverEntry],
        this,
      )
    }
    unobserve() {}
    disconnect() {}
  }
})

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
  onSkip: vi.fn(),
  onCancel: vi.fn(),
}

describe('PhotographStep', () => {
  it('renders select with options 0–5', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(6)
    expect(options.map((o) => o.textContent)).toEqual(['0', '1', '2', '3', '4', '5'])
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

  it('shows hint text inside the square mask overlay', () => {
    render(<PhotographStep {...defaultProps} photos={[]} />, { wrapper })
    // Hint text is rendered inside the square mask when squareSide > 0 (ResizeObserver fires)
    expect(screen.getByText('Set number of images, position book, then Capture')).toBeInTheDocument()
  })

  it('primary button label is CAPTURE', () => {
    render(<PhotographStep {...defaultProps} />, { wrapper })
    expect(screen.getByRole('button', { name: 'CAPTURE' })).toBeInTheDocument()
  })
})
