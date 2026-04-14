import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock getUserMedia before importing LookupStep
const mockTrack = {
  getCapabilities: () => ({ torch: false }),
  applyConstraints: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
}
const mockStream = {
  getVideoTracks: () => [mockTrack],
  getTracks: () => [mockTrack],
}
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
  configurable: true,
  writable: true,
})

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromCanvas: vi.fn().mockImplementation(() => { throw new Error('no barcode') }),
  })),
}))

vi.mock('../../api/books', () => ({
  lookupIsbn: vi.fn(),
}))

import LookupStep from '../../components/workflow/LookupStep'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('LookupStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders in camera mode by default — shows video element', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    expect(document.querySelector('video')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('switches to keyboard mode when keyboard icon button pressed', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })

  it('switches back to camera mode from keyboard mode', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    fireEvent.click(screen.getByLabelText('Switch to camera'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toBeInTheDocument()
  })

  it('shows camera-mode hint text inside the mask overlay', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    // Hint text is rendered inside the camera mask overlay, not in the hintText zone
    expect(screen.getByText('Align barcode then tap Lookup, or use keyboard')).toBeInTheDocument()
  })

  it('shows no static hint text in keyboard mode (only errors when they occur)', () => {
    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    // Keyboard mode has no static hint text; hintText zone only shows errors
    expect(screen.queryByText('Type ISBN and tap Lookup')).not.toBeInTheDocument()
  })

  it('in keyboard mode, calls lookupIsbn with entered value on LOOKUP press', async () => {
    const { lookupIsbn } = await import('../../api/books')
    const mockLookup = lookupIsbn as ReturnType<typeof vi.fn>
    mockLookup.mockResolvedValue({
      isbn: '9781234567890',
      title: 'Test',
      needs_metadata_review: false,
      author: null, publisher: null, edition: null, year: null,
      pages: null, dimensions: null, weight: null,
      description: null, condition: null, cover_image_url: null, data_sources: null,
    })

    render(
      <LookupStep onLookupComplete={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    )
    fireEvent.click(screen.getByLabelText('Switch to keyboard input'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '9781234567890' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'LOOKUP' }))
    })

    expect(mockLookup).toHaveBeenCalledWith('9781234567890')
  })
})
