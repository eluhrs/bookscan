import type { Book } from '../types';
import PhotoFilmstrip from './PhotoFilmstrip';

export interface BookCardProps {
  editable: boolean;
  book: Book;
  photos: Array<{ key: string; url: string }>;
  photoUrls: Record<string, string>;
  onSave: (draft: Partial<Book>) => Promise<void> | void;
  onImmediateSave: (patch: Partial<Book>) => Promise<void> | void;
  onDeletePhoto?: (key: string) => void;
  onAddPhoto?: (file: File) => void;
  onRegenerateDescription?: () => void;
  regeneratingDescription?: boolean;
  descriptionSource?: string | null;
}

export default function BookCard(props: BookCardProps) {
  const { book } = props;
  return (
    <div className="bc-root">
      <PhotoFilmstrip
        coverUrl={book.cover_image_url ?? null}
        photos={props.photos}
        onDelete={props.onDeletePhoto ?? (() => {})}
        onAddPhoto={props.onAddPhoto}
      />
      <h2 className="bc-title">{book.title ?? ''}</h2>
      <div className="bc-author">{book.author ?? ''}</div>
      <div className="bc-field-full">
        <span className="bc-label">Publisher</span>
        <span className="bc-value">{book.publisher ?? ''}</span>
      </div>
      <div className="bc-row-inline">
        <span>
          <span className="bc-label">Year</span>
          <span className="bc-value-sm">{book.year ?? ''}</span>
        </span>
        <span>
          <span className="bc-label">ISBN</span>
          <span className="bc-value-sm bc-value-mono">{book.isbn ?? ''}</span>
        </span>
        <span>
          <span className="bc-label">Pages</span>
          <span className="bc-value-sm">{book.pages ?? ''}</span>
        </span>
      </div>
    </div>
  );
}
