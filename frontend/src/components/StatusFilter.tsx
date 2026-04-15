import { useState, useRef, useEffect } from 'react'
import { Filter, ChevronDown } from 'lucide-react'
import { theme } from '../styles/theme'

export type StatusFilterValue =
  | 'all'
  | 'needs_metadata_review'
  | 'needs_photo_review'
  | 'needs_description_review'
  | 'ready'
  | 'archived'

interface Option {
  value: StatusFilterValue
  label: string
  disabled?: boolean
}

const OPTIONS: Option[] = [
  { value: 'all', label: 'All records' },
  { value: 'needs_metadata_review', label: 'Needs metadata review' },
  { value: 'needs_photo_review', label: 'Needs photography' },
  { value: 'needs_description_review', label: 'Needs description review' },
  { value: 'ready', label: 'Ready to list' },
  { value: 'archived', label: 'Archived', disabled: true },
]

interface Props {
  value: StatusFilterValue
  onChange: (v: StatusFilterValue) => void
}

export default function StatusFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Border color matches the active filter so the button's accent reflects
  // which review lane is being filtered.
  const borderColor =
    value === 'needs_metadata_review' ? '#BA7517' :
    value === 'needs_photo_review' ? '#0070F3' :
    value === 'needs_description_review' ? '#7F77DD' :
    theme.colors.zoneBorder

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Filter by status"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0.5rem 0.55rem',
          border: `1px solid ${borderColor}`,
          borderRadius: theme.radius.sm,
          background: theme.colors.bg,
          color: theme.colors.secondaryText,
          cursor: 'pointer',
          fontFamily: theme.font.sans,
        }}
      >
        <Filter size={16} />
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
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return
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
                color: opt.disabled ? theme.colors.disabledText : theme.colors.text,
                cursor: opt.disabled ? 'default' : 'pointer',
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
