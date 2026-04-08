// frontend/src/components/workflow/WorkflowWrapper.tsx

import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { theme } from '../../styles/theme'

type WorkflowStep = 'photograph' | 'lookup' | 'review'

const STEPS: WorkflowStep[] = ['photograph', 'lookup', 'review']
const STEP_LABELS: Record<WorkflowStep, string> = {
  photograph: 'Photograph',
  lookup: 'Metadata',
  review: 'Review',
}

export interface WorkflowWrapperProps {
  step: WorkflowStep
  controls: ReactNode
  hintText?: string
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  onCancel: () => void
  children: ReactNode
  /** Overrides 100dvh — used by LookupStep keyboard mode to track visualViewport height */
  viewportHeight?: number
}

export default function WorkflowWrapper({
  step,
  controls,
  hintText,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  onCancel,
  children,
  viewportHeight,
}: WorkflowWrapperProps) {
  return (
    <div
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        background: theme.colors.surface,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: theme.font.sans,
      }}
    >
      {/* Zone 1: Step indicator — #F0F0F0 background (FEAT-02) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem 0.25rem',
          flexShrink: 0,
          background: '#F0F0F0',
        }}
      >
        {STEPS.map((s, i) => (
          <span
            key={s}
            style={{
              fontSize: '0.78rem',
              color: s === step ? theme.colors.text : theme.colors.muted,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {i > 0 && (
              <span style={{ color: theme.colors.muted, marginRight: '0.25rem' }}>·</span>
            )}
            <span style={{ fontSize: '0.6rem' }}>{s === step ? '●' : '○'}</span>
            <span>{STEP_LABELS[s]}</span>
          </span>
        ))}
      </div>

      {/* Zone 2: Controls bar */}
      <div
        style={{
          padding: '0.4rem 1rem',
          minHeight: '2.75rem',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {controls}
      </div>

      {/* Zone 3: Main content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      {/* Zone 4: Hint text (errors or instructions) */}
      {hintText !== undefined && (
        <div
          style={{
            padding: '0.5rem 1.5rem',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <p style={{ margin: 0, fontSize: '0.82rem', color: theme.colors.muted }}>
            {hintText}
          </p>
        </div>
      )}

      {/* Zone 5: Primary button — shared minHeight 56px (BUG-03/06/12) */}
      <div style={{ padding: '0.5rem 1rem 0.25rem', flexShrink: 0 }}>
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          style={{
            display: 'block',
            width: '100%',
            minHeight: 56,
            padding: '0.75rem 1rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            background: primaryDisabled ? theme.colors.disabled : theme.colors.accent,
            color: primaryDisabled ? theme.colors.disabledText : '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: primaryDisabled ? 'default' : 'pointer',
            fontFamily: theme.font.sans,
          }}
        >
          {primaryLabel}
        </button>
      </div>

      {/* Zone 6: Secondary buttons — #F0F0F0 background (FEAT-03), "Start Over" label (FEAT-04) */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.25rem 1rem 1rem',
          flexShrink: 0,
          background: '#F0F0F0',
        }}
      >
        <Link
          to="/dashboard"
          style={{
            flex: 1,
            display: 'block',
            textAlign: 'center',
            padding: '0.6rem',
            background: theme.colors.subtle,
            color: theme.colors.subtleText,
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontFamily: theme.font.sans,
          }}
        >
          Dashboard
        </Link>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.6rem',
            background: theme.colors.subtle,
            color: theme.colors.subtleText,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontFamily: theme.font.sans,
          }}
        >
          Start Over
        </button>
      </div>
    </div>
  )
}
