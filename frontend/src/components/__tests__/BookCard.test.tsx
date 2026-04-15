import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BookCard from '../BookCard';
import type { Book } from '../../types';

const baseBook: Book = {
  id: 'b1',
  isbn: '9781250255785',
  title: 'Vortex',
  author: 'Robert Charles Wilson',
  publisher: 'Tor Books',
  edition: null,
  year: 2012,
  pages: 336,
  dimensions: null,
  weight: null,
  description: 'A novel.',
  cover_image_url: null,
  cover_image_local: null,
  data_sources: null,
  needs_metadata_review: false,
  needs_photo_review: false,
  needs_description_review: false,
  description_source: 'google_books',
  description_generation_failed: false,
  condition: 'Good',
  has_photos: false,
  created_at: '2026-04-15T00:00:00Z',
  updated_at: '2026-04-15T00:00:00Z',
} as unknown as Book;

describe('BookCard', () => {
  it('renders title, author, publisher and inline Year/ISBN/Pages row (editable=false)', () => {
    render(
      <BookCard
        editable={false}
        book={baseBook}
        photos={[]}
        photoUrls={{}}
        onSave={vi.fn()}
        onImmediateSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Vortex')).toHaveClass('bc-title');
    expect(screen.getByText('Robert Charles Wilson')).toHaveClass('bc-author');
    expect(screen.getByText('Tor Books')).toBeInTheDocument();
    expect(screen.getByText('2012')).toBeInTheDocument();
    expect(screen.getByText('9781250255785')).toBeInTheDocument();
    expect(screen.getByText('336')).toBeInTheDocument();
  });

  it('renders dashed-underline editable Title, Author, Publisher, Year, ISBN, Pages when editable=true', () => {
    render(
      <BookCard
        editable
        book={baseBook}
        photos={[]}
        photoUrls={{}}
        onSave={vi.fn()}
        onImmediateSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Vortex').closest('.bc-editable')).not.toBeNull();
    expect(screen.getByText('Robert Charles Wilson').closest('.bc-editable')).not.toBeNull();
    expect(screen.getByText('2012').closest('.bc-editable')).not.toBeNull();
    expect(screen.getByText('Tor Books').closest('.bc-editable')).not.toBeNull();
    expect(screen.getByText('9781250255785').closest('.bc-editable')).not.toBeNull();
    expect(screen.getByText('336').closest('.bc-editable')).not.toBeNull();
  });

  it('does NOT dashed-underline any fields when editable=false', () => {
    render(
      <BookCard
        editable={false}
        book={baseBook}
        photos={[]}
        photoUrls={{}}
        onSave={vi.fn()}
        onImmediateSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Vortex').closest('.bc-editable')).toBeNull();
    expect(screen.getByText('2012').closest('.bc-editable')).toBeNull();
  });
});
