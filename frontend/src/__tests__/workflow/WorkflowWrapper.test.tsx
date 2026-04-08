import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import WorkflowWrapper from '../../components/workflow/WorkflowWrapper'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

const defaultProps = {
  step: 'lookup' as const,
  controls: null,
  primaryLabel: 'LOOKUP',
  onPrimary: vi.fn(),
  onCancel: vi.fn(),
  children: <div>main content</div>,
}

describe('WorkflowWrapper', () => {
  it('marks only the current step with a filled dot', () => {
    render(<WorkflowWrapper {...defaultProps} step="lookup" />, { wrapper })
    expect(screen.getAllByText('●')).toHaveLength(1)
    expect(screen.getAllByText('○')).toHaveLength(2)
  })

  it('labels the steps: Photograph, Metadata, Review', () => {
    render(<WorkflowWrapper {...defaultProps} />, { wrapper })
    expect(screen.getByText('Photograph')).toBeInTheDocument()
    expect(screen.getByText('Metadata')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('renders primary button with the given label', () => {
    render(<WorkflowWrapper {...defaultProps} primaryLabel="CAPTURE" />, { wrapper })
    expect(screen.getByRole('button', { name: 'CAPTURE' })).toBeInTheDocument()
  })

  it('disables primary button when primaryDisabled is true', () => {
    render(<WorkflowWrapper {...defaultProps} primaryDisabled />, { wrapper })
    expect(screen.getByRole('button', { name: 'LOOKUP' })).toBeDisabled()
  })

  it('calls onPrimary when primary button is clicked', () => {
    const onPrimary = vi.fn()
    render(<WorkflowWrapper {...defaultProps} onPrimary={onPrimary} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'LOOKUP' }))
    expect(onPrimary).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<WorkflowWrapper {...defaultProps} onCancel={onCancel} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Start Over' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('renders a Dashboard link in the header', () => {
    render(<WorkflowWrapper {...defaultProps} />, { wrapper })
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument()
  })

  it('renders children in the main content area', () => {
    render(<WorkflowWrapper {...defaultProps} children={<div>unique-content</div>} />, { wrapper })
    expect(screen.getByText('unique-content')).toBeInTheDocument()
  })

  it('renders controls content when controls is non-null', () => {
    render(
      <WorkflowWrapper {...defaultProps} controls={<div>controls-content</div>} />,
      { wrapper }
    )
    expect(screen.getByText('controls-content')).toBeInTheDocument()
  })

  it('Zone 2 wrapper div is absent from DOM when controls is null', () => {
    // When controls is non-null, the Zone 2 wrapper renders and contains the controls
    const { container } = render(
      <WorkflowWrapper {...defaultProps} controls={<div data-testid="zone2-content">ctrl</div>} />,
      { wrapper }
    )
    expect(container.querySelector('[data-testid="zone2-content"]')).toBeInTheDocument()

    // When controls is null, Zone 2 should not render — no empty wrapper div taking space
    const { container: c2 } = render(
      <WorkflowWrapper {...defaultProps} controls={null} />,
      { wrapper }
    )
    // The outer flex container should have exactly: step-indicator, main-content, (optional hint), primary-btn, secondary-bar
    // Zone 2 wrapper has minHeight style — verify no child has that style
    const outerChildren = Array.from(c2.firstChild?.childNodes ?? []) as HTMLElement[]
    const hasZone2 = outerChildren.some(
      (el) => el instanceof HTMLElement && el.style?.minHeight === '2.75rem'
    )
    expect(hasZone2).toBe(false)
  })
})
