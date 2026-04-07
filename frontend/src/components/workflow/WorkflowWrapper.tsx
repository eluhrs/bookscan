import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { theme } from '../../styles/theme'

type WorkflowStep = 'photograph' | 'lookup' | 'review'

const STEPS: WorkflowStep[] = ['photograph', 'lookup', 'review']
const STEP_LABELS: Record<WorkflowStep, string> = {
  photograph: 'Photograph',
  lookup: 'Lookup',
  review: 'Review',
}

export interface WorkflowWrapperProps {
  step: WorkflowStep
  controls: ReactNode
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  onCancel: () => void
  children: ReactNode
}

export default function WorkflowWrapper({
  step,
  controls,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  onCancel,
  children,
}: WorkflowWrapperProps) {
  return (
    <div
      style={{
        height: '100dvh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Zone 1: Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <strong>BookScan</strong>
        <Link to="/dashboard" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>
          Dashboard →
        </Link>
      </div>

      {/* Zone 2: Progress indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '0.4rem 1rem',
          flexShrink: 0,
        }}
      >
        {STEPS.map((s) => (
          <span
            key={s}
            style={{
              fontSize: '0.78rem',
              color: s === step ? '#fff' : '#555',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>{s === step ? '●' : '○'}</span>
            <span>{STEP_LABELS[s]}</span>
          </span>
        ))}
      </div>

      {/* Zone 3: Controls bar */}
      <div
        style={{
          padding: '0.4rem 1rem',
          minHeight: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {controls}
      </div>

      {/* Zone 4: Main content — grows to fill remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      {/* Zone 5: Primary button */}
      <div style={{ padding: '0.75rem 1rem 0.25rem', flexShrink: 0 }}>
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          style={{
            display: 'block',
            width: '100%',
            padding: '1rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: primaryDisabled ? '#222' : theme.colors.accent,
            color: primaryDisabled ? '#555' : '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: primaryDisabled ? 'default' : 'pointer',
          }}
        >
          {primaryLabel}
        </button>
      </div>

      {/* Zone 6: Cancel */}
      <div style={{ padding: '0.25rem 1rem 1rem', textAlign: 'center', flexShrink: 0 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '0.9rem',
            padding: '0.4rem 0.75rem',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
