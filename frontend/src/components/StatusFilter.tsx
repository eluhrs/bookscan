import { useState, useRef, useEffect } from 'react'
import { Tag, Eye, ChevronDown } from 'lucide-react'
import { theme } from '../styles/theme'

export type StatusTagValue = 'all' | 'ready' | 'archived'
export type ReviewEyeValue =
  | ''
  | 'needs_metadata_review'
  | 'needs_photo_review'
  | 'needs_description_review'
  | 'needs_price'

// --- Shared dropdown shell ---

interface DropdownOption<V extends string> {
  value: V
  label: string
}

interface FilterButtonProps<V extends string> {
  icon: React.ReactNode
  ariaLabel: string
  borderColor: string
  fillColor: string
  options: DropdownOption<V>[]
  value: V
  onChange: (v: V) => void
}

function FilterButton<V extends string>({
  icon,
  ariaLabel,
  borderColor,
  fillColor,
  options,
  value,
  onChange,
}: FilterButtonProps<V>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0.5rem 0.55rem',
          border: `1px solid ${borderColor}`,
          borderRadius: theme.radius.sm,
          background: fillColor,
          color: theme.colors.secondaryText,
          cursor: 'pointer',
          fontFamily: theme.font.sans,
        }}
      >
        {icon}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 200,
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.zoneBorder}`,
            borderRadius: theme.radius.sm,
            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
            zIndex: 20,
            padding: '0.25rem 0',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                background: value === opt.value ? theme.colors.tableHeaderBg : 'transparent',
                border: 'none',
                fontSize: '0.85rem',
                color: theme.colors.text,
                cursor: 'pointer',
                fontFamily: theme.font.sans,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Status (Tag) filter ---

const STATUS_OPTIONS: DropdownOption<StatusTagValue>[] = [
  { value: 'all', label: 'All records' },
  { value: 'ready', label: 'Ready to list' },
  { value: 'archived', label: 'Archived' },
]

function getStatusStyle(value: StatusTagValue) {
  if (value === 'ready') return { border: '#3B6D11', fill: theme.colors.filterGreenFill }
  if (value === 'archived') return { border: '#888', fill: theme.colors.filterGrayFill }
  return { border: theme.colors.zoneBorder, fill: theme.colors.bg }
}

interface StatusTagProps {
  value: StatusTagValue
  onChange: (v: StatusTagValue) => void
}

export function StatusTagFilter({ value, onChange }: StatusTagProps) {
  const style = getStatusStyle(value)
  return (
    <FilterButton
      icon={<Tag size={16} />}
      ariaLabel="Filter by status"
      borderColor={style.border}
      fillColor={style.fill}
      options={STATUS_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}

// --- Review (Eye) filter ---

const REVIEW_OPTIONS: DropdownOption<ReviewEyeValue>[] = [
  { value: '', label: 'No filter' },
  { value: 'needs_metadata_review', label: 'Metadata Review' },
  { value: 'needs_photo_review', label: 'Photography Review' },
  { value: 'needs_description_review', label: 'Description Review' },
  { value: 'needs_price', label: 'Price' },
]

function getReviewStyle(value: ReviewEyeValue) {
  if (value === 'needs_metadata_review') return { border: '#BA7517', fill: theme.colors.filterAmberFill }
  if (value === 'needs_photo_review') return { border: '#0070F3', fill: theme.colors.filterBlueFill }
  if (value === 'needs_description_review') return { border: '#7F77DD', fill: theme.colors.filterPurpleFill }
  if (value === 'needs_price') return { border: '#888', fill: theme.colors.filterGrayFill }
  return { border: theme.colors.zoneBorder, fill: theme.colors.bg }
}

interface ReviewEyeProps {
  value: ReviewEyeValue
  onChange: (v: ReviewEyeValue) => void
}

export function ReviewEyeFilter({ value, onChange }: ReviewEyeProps) {
  const style = getReviewStyle(value)
  return (
    <FilterButton
      icon={<Eye size={16} />}
      ariaLabel="Filter by review status"
      borderColor={style.border}
      fillColor={style.fill}
      options={REVIEW_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}
