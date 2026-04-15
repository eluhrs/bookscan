import { render, screen, fireEvent } from '@testing-library/react'
import DescriptionSourceIcon from '../DescriptionSourceIcon'

describe('DescriptionSourceIcon', () => {
  it('renders Database icon for open_library without onRegenerate handler invoked on click', () => {
    const spy = vi.fn()
    render(<DescriptionSourceIcon source="open_library" onRegenerate={spy} />)
    const btn = screen.queryByRole('button', { name: /regenerate/i })
    expect(btn).toBeNull()
    expect(screen.getByLabelText(/catalog source/i)).toBeInTheDocument()
  })

  it('renders Sparkles button for ai_generated and calls onRegenerate on click', () => {
    const spy = vi.fn()
    render(<DescriptionSourceIcon source="ai_generated" onRegenerate={spy} />)
    const btn = screen.getByRole('button', { name: /regenerate/i })
    fireEvent.click(btn)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for manual source', () => {
    const { container } = render(<DescriptionSourceIcon source="manual" onRegenerate={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for null source', () => {
    const { container } = render(<DescriptionSourceIcon source={null} onRegenerate={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a loading indicator when regenerating prop is true', () => {
    render(<DescriptionSourceIcon source="ai_generated" regenerating onRegenerate={() => {}} />)
    expect(screen.getByLabelText(/regenerating/i)).toBeInTheDocument()
  })
})
