import { useState, useEffect } from 'react';
import type { Book } from '../types';
import PhotoFilmstrip from './PhotoFilmstrip';
import DescriptionSourceIcon from './DescriptionSourceIcon';
import { theme } from '../styles/theme';

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

const CONDITIONS = ['Very Good', 'Good', 'Acceptable'] as const

// Shared height for both button rows (condition + review toggles) so the
// two rows look like a unified 2×3 control block.
const ROW_BUTTON_HEIGHT = 48

// ---- ConditionBar ----
interface ConditionBarProps {
  value: string | null
  onChange: (v: string) => void
}

function ConditionBar({ value, onChange }: ConditionBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        border: `1px solid ${theme.colors.zoneBorder}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {CONDITIONS.map((c, i) => {
        const selected = value === c
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              flex: 1,
              height: ROW_BUTTON_HEIGHT,
              padding: '0 0.4rem',
              fontSize: 13,
              fontWeight: selected ? 500 : 400,
              background: selected ? theme.colors.primaryBlue : theme.colors.bg,
              color: selected ? '#fff' : theme.colors.secondaryText,
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${theme.colors.zoneBorder}`,
              cursor: 'pointer',
              fontFamily: theme.font.sans,
              lineHeight: 1.15,
            }}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

// ---- ReviewToggle ----
function ReviewToggle({ word1, word2, on, onToggle }: {
  word1: string
  word2: string
  on: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      aria-pressed={on}
      aria-label={`${word1} ${word2}`}
      style={{
        height: ROW_BUTTON_HEIGHT,
        padding: '0 0.5rem',
        border: on ? 'none' : `1px solid ${theme.colors.zoneBorder}`,
        borderRadius: theme.radius.md,
        background: on ? theme.colors.primaryBlue : theme.colors.bg,
        color: on ? '#fff' : theme.colors.secondaryText,
        fontWeight: on ? 500 : 400,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: theme.font.sans,
        lineHeight: 1.1,
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      <span className="review-toggle-label">
        {word1}<span className="rt-break"> </span>{word2}
      </span>
    </button>
  )
}

// ---- DraftFields ----
interface DraftFields {
  title: string | null;
  author: string | null;
  publisher: string | null;
  year: string;
  pages: string;
  edition: string | null;
  dimensions: string | null;
  weight: string | null;
  description: string | null;
  condition: string | null;
}

// ---- InlineField ----
interface InlineFieldProps {
  value: string | number | null;
  onChange: (v: string) => void;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  mono?: boolean;
  multiline?: boolean;
  placeholder?: string;
}

function InlineField({
  value,
  onChange,
  fontSize = 13,
  fontWeight = 400,
  color = theme.colors.subtleText,
  mono = false,
  multiline = false,
  placeholder = '',
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value));

  useEffect(() => {
    setLocal(value === null || value === undefined ? '' : String(value));
  }, [value]);

  const displayStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color: local ? color : theme.colors.muted,
    fontStyle: local ? 'normal' : 'italic',
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    display: 'inline-block',
  };

  const inputStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color,
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    width: '100%',
    padding: '1px 3px',
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: 3,
    outline: 'none',
    resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 160 : undefined,
    lineHeight: 1.4,
    boxSizing: 'border-box',
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          value={local}
          style={inputStyle}
          autoFocus
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onChange(local);
          }}
        />
      );
    }
    return (
      <input
        type="text"
        value={local}
        style={inputStyle}
        autoFocus
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onChange(local);
        }}
      />
    );
  }

  return (
    <span
      className="bc-editable"
      style={displayStyle}
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setEditing(true);
      }}
    >
      {local || <span style={{ color: theme.colors.muted, fontStyle: 'italic' }}>{placeholder || '\u200b'}</span>}
    </span>
  );
}

export default function BookCard(props: BookCardProps) {
  const { book, editable } = props;

  const [draft, setDraft] = useState<DraftFields>({
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    year: book.year != null ? String(book.year) : '',
    pages: book.pages != null ? String(book.pages) : '',
    edition: book.edition,
    dimensions: book.dimensions,
    weight: book.weight,
    description: book.description,
    condition: book.condition,
  });

  // Re-sync draft when book prop changes (e.g. after parent save)
  useEffect(() => {
    setDraft({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      year: book.year != null ? String(book.year) : '',
      pages: book.pages != null ? String(book.pages) : '',
      edition: book.edition,
      dimensions: book.dimensions,
      weight: book.weight,
      description: book.description,
      condition: book.condition,
    });
  }, [book]);

  return (
    <div className="bc-root">
      <PhotoFilmstrip
        coverUrl={book.cover_image_url ?? null}
        photos={props.photos}
        onDelete={props.onDeletePhoto ?? (() => {})}
        onAddPhoto={props.onAddPhoto}
      />

      {/* Title */}
      {editable ? (
        <InlineField
          value={draft.title}
          fontSize={18}
          fontWeight={500}
          color="#222"
          onChange={(v) => setDraft((d) => ({ ...d, title: v || null }))}
          placeholder="Title"
        />
      ) : (
        <h2 className="bc-title">{book.title ?? ''}</h2>
      )}

      {/* Author */}
      {editable ? (
        <InlineField
          value={draft.author}
          fontSize={14}
          fontWeight={400}
          color="#222"
          onChange={(v) => setDraft((d) => ({ ...d, author: v || null }))}
          placeholder="Author"
        />
      ) : (
        <div className="bc-author">{book.author ?? ''}</div>
      )}

      {/* Publisher */}
      <div className="bc-field-full">
        <span className="bc-label">Publisher</span>
        {editable ? (
          <InlineField
            value={draft.publisher}
            fontSize={12}
            fontWeight={400}
            color="#222"
            onChange={(v) => setDraft((d) => ({ ...d, publisher: v || null }))}
            placeholder="Publisher"
          />
        ) : (
          <span className="bc-value">{book.publisher ?? ''}</span>
        )}
      </div>

      <div className="bc-row-inline">
        {/* Year */}
        <span>
          <span className="bc-label">Year</span>
          {editable ? (
            <InlineField
              value={draft.year}
              fontSize={11}
              fontWeight={400}
              color="#222"
              onChange={(v) => {
                const sanitized = v.replace(/[^0-9]/g, '').slice(0, 4);
                setDraft((d) => ({ ...d, year: sanitized }));
              }}
              placeholder="Year"
            />
          ) : (
            <span className="bc-value-sm">{book.year ?? ''}</span>
          )}
        </span>

        {/* ISBN — always read-only, but gets .bc-editable class when editable=true for visual consistency */}
        <span>
          <span className="bc-label">ISBN</span>
          {editable ? (
            <span
              className="bc-value-sm bc-value-mono bc-editable"
              style={{ cursor: 'default', fontSize: 11, display: 'inline-block' }}
            >
              {book.isbn ?? ''}
            </span>
          ) : (
            <span className="bc-value-sm bc-value-mono">{book.isbn ?? ''}</span>
          )}
        </span>

        {/* Pages */}
        <span>
          <span className="bc-label">Pages</span>
          {editable ? (
            <InlineField
              value={draft.pages}
              fontSize={11}
              fontWeight={400}
              color="#222"
              mono
              onChange={(v) => {
                const sanitized = v.replace(/[^0-9]/g, '');
                setDraft((d) => ({ ...d, pages: sanitized }));
              }}
              placeholder="Pages"
            />
          ) : (
            <span className="bc-value-sm">{book.pages ?? ''}</span>
          )}
        </span>
      </div>

      <ConditionBar
        value={((draft.condition as string) || (book.condition as string) || '') as 'Very Good' | 'Good' | 'Acceptable' | ''}
        onChange={(c) => {
          setDraft({ ...draft, condition: c ?? '' });
          props.onImmediateSave({ condition: c });
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <ReviewToggle
          word1="review"
          word2="metadata"
          on={!!book.needs_metadata_review}
          onToggle={(next) => props.onImmediateSave({ needs_metadata_review: next })}
        />
        <ReviewToggle
          word1="review"
          word2="photography"
          on={!!book.needs_photo_review}
          onToggle={(next) => props.onImmediateSave({ needs_photo_review: next })}
        />
        <ReviewToggle
          word1="review"
          word2="description"
          on={!!book.needs_description_review}
          onToggle={(next) => props.onImmediateSave({ needs_description_review: next })}
        />
      </div>

      {/* Description */}
      <div style={{ marginTop: 16 }}>
        <div className="bc-description-label">
          <span className="bc-label">Description</span>
          <DescriptionSourceIcon
            source={(props.descriptionSource ?? book.description_source ?? (book.data_sources?.description ?? null)) as Parameters<typeof DescriptionSourceIcon>[0]['source']}
            regenerating={!!props.regeneratingDescription}
            onRegenerate={props.onRegenerateDescription ?? (() => {})}
          />
        </div>
        {editable ? (
          <div className="bc-field-full" style={{ marginTop: 6 }}>
            <InlineField
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
              multiline
              fontSize={13}
              color="#222"
              placeholder="No description"
            />
          </div>
        ) : (
          <p style={{ marginTop: 6, fontSize: 13, color: '#222' }}>
            {book.description || ''}
          </p>
        )}
      </div>
    </div>
  );
}
