import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import PhotoFilmstrip from '../components/PhotoFilmstrip'

const photos = [
  { key: 'p1', url: 'blob:http://localhost/p1' },
  { key: 'p2', url: 'blob:http://localhost/p2' },
]

describe('PhotoFilmstrip', () => {
  it('renders cover image with accent border when coverUrl is provided', () => {
    render(
      <PhotoFilmstrip
        coverUrl="http://example.com/cover.jpg"
        photos={[]}
        onDelete={vi.fn()}
      />
    )
    const img = screen.getByAltText('Cover')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'http://example.com/cover.jpg')
  })

  it('shows No cover placeholder when coverUrl is null', () => {
    render(<PhotoFilmstrip coverUrl={null} photos={[]} onDelete={vi.fn()} />)
    expect(screen.getByText('No cover')).toBeInTheDocument()
  })

  it('renders user photos with alt text', () => {
    render(<PhotoFilmstrip coverUrl={null} photos={photos} onDelete={vi.fn()} />)
    expect(screen.getByAltText('Photo 1')).toBeInTheDocument()
    expect(screen.getByAltText('Photo 2')).toBeInTheDocument()
  })

  it('renders a delete button for each user photo', () => {
    render(<PhotoFilmstrip coverUrl={null} photos={photos} onDelete={vi.fn()} />)
    expect(screen.getAllByLabelText('Delete photo')).toHaveLength(2)
  })

  it('calls onDelete with the correct key when delete button clicked', () => {
    const onDelete = vi.fn()
    render(<PhotoFilmstrip coverUrl={null} photos={photos} onDelete={onDelete} />)
    fireEvent.click(screen.getAllByLabelText('Delete photo')[0])
    expect(onDelete).toHaveBeenCalledWith('p1')
  })

  it('does not render delete buttons for the cover image', () => {
    render(
      <PhotoFilmstrip
        coverUrl="http://example.com/cover.jpg"
        photos={[]}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByLabelText('Delete photo')).not.toBeInTheDocument()
  })
})
