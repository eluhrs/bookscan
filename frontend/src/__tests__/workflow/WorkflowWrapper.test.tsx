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
})
