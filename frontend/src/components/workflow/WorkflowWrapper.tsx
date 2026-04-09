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
      {/* Zone 1: Step indicator — #E0E0E0 background, equal height to Zone 6 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0 1rem',
          minHeight: '3rem',
          flexShrink: 0,
          background: theme.colors.zoneBg,
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

      {/* Middle: Zones 2–5 in a flex column with consistent gap.
          The gap value creates equal whitespace between controls bar,
          main content, hint text, and primary button. */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0.75rem 1rem',
          gap: '0.75rem',
          overflow: 'hidden',
          background: theme.colors.surface,
        }}
      >
        {/* Zone 2: Controls bar — only rendered when controls !== null.
            Review screen passes null; gap above content handles spacing. */}
        {controls !== null && (
          <div style={{ flexShrink: 0 }}>
            {controls}
          </div>
        )}

        {/* Zone 3: Main content — fills remaining space */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>

        {/* Zone 4: Hint text — only rendered when hintText is defined */}
        {hintText !== undefined && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: theme.colors.muted }}>
              {hintText}
            </p>
          </div>
        )}

        {/* Zone 5: Primary button — 64px min height (FIX-01) */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={onPrimary}
            disabled={primaryDisabled}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 64,
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
      </div>

      {/* Zone 6: Secondary buttons — #E0E0E0 background, equal height to Zone 1.
          Footer buttons use #FFFFFF fill to stand out against the zone background. */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0 1rem',
          minHeight: '3rem',
          alignItems: 'center',
          flexShrink: 0,
          background: theme.colors.zoneBg,
        }}
      >
        <Link
          to="/dashboard"
          style={{
            flex: 1,
            display: 'block',
            textAlign: 'center',
            padding: '0.5rem',
            background: theme.colors.footerButtonBg,
            color: theme.colors.subtleText,
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontFamily: theme.font.sans,
            border: `1px solid ${theme.colors.controlsBorder}`,
          }}
        >
          Dashboard
        </Link>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.5rem',
            background: theme.colors.footerButtonBg,
            color: theme.colors.subtleText,
            border: `1px solid ${theme.colors.controlsBorder}`,
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
