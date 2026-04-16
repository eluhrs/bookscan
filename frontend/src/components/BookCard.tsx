import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Book } from '../types';
import PhotoFilmstrip from './PhotoFilmstrip';
import DescriptionSourceIcon from './DescriptionSourceIcon';
import { Check, ChevronDown } from 'lucide-react';
import { theme } from '../styles/theme';

export interface BookCardHandle {
  commitDraft: () => Promise<void>;
  /** Read the current draft without any side effects. Used by ReviewStep,
      which has no persisted book yet and needs the latest values to build
      its POST /books payload. */
  getDraft: () => Partial<Book>;
}

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
  /** Show price/category row (desktop edit only, not mobile or Review step) */
  showListingFields?: boolean;
  descriptionSource?: string | null;
}

const CONDITIONS = ['Very Good', 'Good', 'Acceptable'] as const

// Shared height for both button rows (condition + review toggles) so the
// two rows look like a unified 2×3 control block.
const ROW_BUTTON_HEIGHT = 48

const CATEGORIES = [
  'Science Fiction',
  'History',
  'Science',
  'Social Sciences',
  'Philosophy',
  'Travel',
  'Textbooks & Education',
  'Antiquarian & Collectible',
  'Other',
] as const

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
  isbn: string;
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
  /** compact = sized to content (for Year/Pages/ISBN), not full-width block */
  compact?: boolean;
}

function InlineField({
  value,
  onChange,
  fontSize = 13,
  fontWeight = 400,
  color = '#222',
  mono = false,
  multiline = false,
  placeholder = '',
  compact = false,
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
    display: compact ? 'inline' : 'block',
    whiteSpace: multiline ? 'pre-wrap' : undefined,
    minHeight: compact ? undefined : '1.4em',
    lineHeight: 1.4,
    cursor: 'text',
  };

  const inputStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color,
    fontFamily: mono ? theme.font.mono : theme.font.sans,
    width: compact ? `${Math.max(2, local.length || (placeholder || '').length || 4) + 1}ch` : '100%',
    padding: '1px 3px',
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: 3,
    outline: 'none',
    resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 160 : undefined,
    lineHeight: 1.4,
    boxSizing: 'border-box',
    display: compact ? 'inline-block' : 'block',
    verticalAlign: 'baseline',
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
      {local || <span style={{ color: theme.colors.muted, fontStyle: 'italic' }}>{placeholder || '—'}</span>}
    </span>
  );
}

function PriceCategoryRow({ book, onImmediateSave }: {
  book: Book
  onImmediateSave: (patch: Partial<Book>) => Promise<void> | void
}) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceLocal, setPriceLocal] = useState(
    book.price != null ? String(book.price) : ''
  )
  const [categoryOpen, setCategoryOpen] = useState(false)
  const catRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setPriceLocal(book.price != null ? String(book.price) : '')
  }, [book.price])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCategoryOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const hasPrice = book.price != null && book.price > 0
  const hasCategory = !!book.ebay_category_name

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
      {/* Price */}
      <button
        type="button"
        onClick={() => setEditingPrice(true)}
        style={{
          height: ROW_BUTTON_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          border: hasPrice ? 'none' : `1px solid ${theme.colors.zoneBorder}`,
          borderRadius: theme.radius.md,
          background: hasPrice ? theme.colors.primaryBlue : theme.colors.bg,
          cursor: 'pointer',
          padding: 0,
          overflow: 'hidden',
          fontFamily: theme.font.sans,
        }}
      >
        <span style={{
          padding: '0 10px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
          color: hasPrice ? '#fff' : theme.colors.secondaryText,
          borderRight: `1px solid ${hasPrice ? 'rgba(255,255,255,0.3)' : theme.colors.zoneBorder}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}>
          Price
        </span>
        <span style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          fontSize: 14,
          color: hasPrice ? '#fff' : theme.colors.secondaryText,
        }}>
          {editingPrice ? (
            <span style={{ display: 'flex', alignItems: 'center', width: '100%' }} onClick={(e) => e.stopPropagation()}>
              <span style={{ marginRight: 4 }}>$</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={priceLocal}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '')
                  setPriceLocal(v)
                }}
                onBlur={() => {
                  setEditingPrice(false)
                  const num = parseFloat(priceLocal)
                  const newPrice = isNaN(num) ? null : Math.round(num * 100) / 100
                  onImmediateSave({ price: newPrice as any })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  color: hasPrice ? '#fff' : '#222',
                  fontFamily: theme.font.sans,
                }}
              />
            </span>
          ) : (
            <>
              <span style={{ marginRight: 2 }}>$</span>
              {hasPrice ? Number(book.price).toFixed(2) : '0.00'}
            </>
          )}
        </span>
      </button>

      {/* Category */}
      <div ref={catRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setCategoryOpen((o) => !o)}
          style={{
            width: '100%',
            height: ROW_BUTTON_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            border: hasCategory ? 'none' : `1px solid ${theme.colors.zoneBorder}`,
            borderRadius: theme.radius.md,
            background: hasCategory ? theme.colors.primaryBlue : theme.colors.bg,
            cursor: 'pointer',
            padding: 0,
            overflow: 'hidden',
            fontFamily: theme.font.sans,
          }}
        >
          <span style={{
            padding: '0 10px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            color: hasCategory ? '#fff' : theme.colors.secondaryText,
            borderRight: `1px solid ${hasCategory ? 'rgba(255,255,255,0.3)' : theme.colors.zoneBorder}`,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}>
            Category
          </span>
          <span style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
            color: hasCategory ? '#fff' : theme.colors.secondaryText,
            fontSize: 14,
          }}>
            {hasCategory ? <Check size={18} /> : '\u2014'}
          </span>
          <span style={{
            padding: '0 8px',
            color: hasCategory ? '#fff' : theme.colors.secondaryText,
            display: 'flex',
            alignItems: 'center',
          }}>
            <ChevronDown size={14} />
          </span>
        </button>

        {categoryOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.zoneBorder}`,
              borderRadius: theme.radius.sm,
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              zIndex: 20,
              padding: '0.25rem 0',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="menuitem"
                onClick={() => {
                  setCategoryOpen(false)
                  onImmediateSave({ ebay_category_name: cat })
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  background: book.ebay_category_name === cat ? theme.colors.tableHeaderBg : 'transparent',
                  border: 'none',
                  fontSize: '0.85rem',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontFamily: theme.font.sans,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const BookCard = forwardRef<BookCardHandle, BookCardProps>(function BookCard(props, ref) {
  const { book, editable } = props;

  const [draft, setDraft] = useState<DraftFields>({
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    isbn: book.isbn ?? '',
    year: book.year != null ? String(book.year) : '',
    pages: book.pages != null ? String(book.pages) : '',
    edition: book.edition,
    dimensions: book.dimensions,
    weight: book.weight,
    description: book.description,
    condition: book.condition,
  });

  // Re-seed the full draft only when a DIFFERENT book is loaded (id change).
  // Re-syncing on every book reference change would clobber in-flight user
  // edits in ReviewStep, where virtualBook re-memoizes on every unrelated
  // state change (condition toggles, aiSummary transitions, etc.).
  useEffect(() => {
    setDraft({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      isbn: book.isbn ?? '',
      year: book.year != null ? String(book.year) : '',
      pages: book.pages != null ? String(book.pages) : '',
      edition: book.edition,
      dimensions: book.dimensions,
      weight: book.weight,
      description: book.description,
      condition: book.condition,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // Description can arrive asynchronously — Gemini in the Review step, or
  // regenerate on the Edit page — so keep draft.description in sync with
  // book.description when the external value changes.
  useEffect(() => {
    setDraft((d) => ({ ...d, description: book.description }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.description]);

  const buildPatch = (): Partial<Book> => {
    const patch: Partial<Book> = {
      title: draft.title || null,
      author: draft.author || null,
      publisher: draft.publisher || null,
      isbn: draft.isbn || book.isbn,
      year: draft.year ? Number(draft.year) : null,
      pages: draft.pages ? Number(draft.pages) : null,
      edition: draft.edition || null,
      dimensions: draft.dimensions || null,
      weight: draft.weight || null,
      description: draft.description || null,
    };
    // If the user edited the description text, mark the source as manual
    // so the icon reflects the edit (matches the old BookEditCard behavior).
    if ((draft.description ?? null) !== (book.description ?? null)) {
      patch.description_source = 'manual';
    }
    return patch;
  };

  useImperativeHandle(ref, () => ({
    commitDraft: async () => {
      await props.onSave(buildPatch());
    },
    getDraft: () => buildPatch(),
  }));

  return (
    <div className="bc-root">
      <PhotoFilmstrip
        coverUrl={book.cover_image_url ?? null}
        photos={props.photos}
        onDelete={props.onDeletePhoto ?? (() => {})}
        onAddPhoto={props.onAddPhoto}
      />

      {/* Title */}
      <div className="bc-title-row">
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
      </div>

      {/* Author */}
      <div className="bc-author-row">
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
      </div>

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
              compact
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

        {/* ISBN */}
        <span>
          <span className="bc-label">ISBN</span>
          {editable ? (
            <InlineField
              value={draft.isbn}
              fontSize={11}
              fontWeight={400}
              color="#222"
              mono
              compact
              onChange={(v) => setDraft((d) => ({ ...d, isbn: v.replace(/[^0-9Xx]/g, '') }))}
              placeholder="ISBN"
            />
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
              compact
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
      {props.showListingFields && (
        <PriceCategoryRow book={book} onImmediateSave={props.onImmediateSave} />
      )}

      {/* Description */}
      <div style={{ marginTop: 20 }}>
        <div className="bc-description-label" style={{ marginBottom: 6 }}>
          <span className="bc-label">Description</span>
          <DescriptionSourceIcon
            source={(props.descriptionSource ?? book.description_source ?? (book.description && book.data_sources?.description ? book.data_sources.description : null)) as Parameters<typeof DescriptionSourceIcon>[0]['source']}
            regenerating={!!props.regeneratingDescription}
            onRegenerate={props.onRegenerateDescription ?? (() => {})}
          />
        </div>
        {(() => {
          const aiPending = !!props.regeneratingDescription
          const aiFailed = !!book.description_generation_failed
          if (editable) {
            if (aiPending && !draft.description) {
              return (
                <div style={{ fontSize: 13, color: theme.colors.muted, fontStyle: 'italic' }}>
                  Generating summary…
                </div>
              )
            }
            return (
              <InlineField
                value={draft.description}
                onChange={(v) => setDraft({ ...draft, description: v })}
                multiline
                fontSize={13}
                color="#222"
                placeholder={aiFailed ? 'Summary unavailable.' : 'No description'}
              />
            )
          }
          if (aiPending) {
            return (
              <div style={{ fontSize: 13, color: theme.colors.muted, fontStyle: 'italic' }}>
                Generating summary…
              </div>
            )
          }
          if (book.description) {
            return (
              <div style={{ fontSize: 13, color: '#222', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {book.description}
              </div>
            )
          }
          return (
            <div style={{ fontSize: 13, color: theme.colors.muted, fontStyle: 'italic' }}>
              {aiFailed ? 'Summary unavailable.' : 'No description'}
            </div>
          )
        })()}
      </div>

      {/* Additional fields — Edition / Dimensions / Weight */}
      {props.editable && (book.edition || book.dimensions || book.weight) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
          <div>
            <div className="bc-label">Edition</div>
            <InlineField
              value={draft.edition}
              onChange={(v) => setDraft({ ...draft, edition: v })}
              fontSize={12}
              color="#222"
              placeholder="—"
            />
          </div>
          <div>
            <div className="bc-label">Dimensions</div>
            <InlineField
              value={draft.dimensions}
              onChange={(v) => setDraft({ ...draft, dimensions: v })}
              fontSize={12}
              color="#222"
              placeholder="—"
            />
          </div>
          <div>
            <div className="bc-label">Weight</div>
            <InlineField
              value={draft.weight}
              onChange={(v) => setDraft({ ...draft, weight: v })}
              fontSize={12}
              color="#222"
              placeholder="—"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default BookCard;
