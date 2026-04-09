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

// Heights of fixed zones — used to compute the middle section's padding-top
// so content is not underlapped by the fixed header.
const ZONE_1_HEIGHT = '3rem'    // step indicator bar
const ZONE_2_HEIGHT = '2.75rem' // controls bar (absent on ReviewStep)
const ZONE_6_HEIGHT = '3rem'    // secondary buttons footer bar
const GAP = '0.75rem'           // gap between header bottom and content top

export interface WorkflowWrapperProps {
  step: WorkflowStep
  controls: ReactNode | null
  hintText?: string
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  onCancel: () => void
  children: ReactNode
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
}: WorkflowWrapperProps) {
  const hasControls = controls !== null

  // Padding-top of the middle section compensates for the height of fixed Zone 1
  // and (when present) fixed Zone 2, plus the visual gap before content.
  const middlePaddingTop = hasControls
    ? `calc(${ZONE_1_HEIGHT} + ${ZONE_2_HEIGHT} + ${GAP})`
    : `calc(${ZONE_1_HEIGHT} + ${GAP})`

  return (
    <div
      style={{
        height: '100dvh',
        background: theme.colors.surface,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: theme.font.sans,
      }}
    >
      {/* Zone 1: Step indicator — position:fixed so it always stays visible at the top,
          even when iOS Safari opens the keyboard and the page scrolls. */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0 1rem',
          minHeight: ZONE_1_HEIGHT,
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

      {/* Zone 2: Controls bar — position:fixed directly below Zone 1.
          Only rendered when controls !== null (ReviewStep passes null). */}
      {hasControls && (
        <div
          style={{
            position: 'fixed',
            top: ZONE_1_HEIGHT,
            left: 0,
            right: 0,
            zIndex: 10,
            background: theme.colors.surface,
            padding: '0 1rem',
            minHeight: ZONE_2_HEIGHT,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {controls}
        </div>
      )}

      {/* Middle: Zones 3–5 in a flex column with consistent gap.
          padding-top offsets the height of the fixed Zone 1 + Zone 2 so content
          starts below the fixed header. Zone 2 is out of this flex flow. */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: middlePaddingTop,
          paddingBottom: `calc(${ZONE_6_HEIGHT} + 0.75rem)`,
          paddingLeft: '1rem',
          paddingRight: '1rem',
          gap: '0.75rem',
          overflow: 'hidden',
          background: theme.colors.surface,
        }}
      >
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

        {/* Zone 5: Primary button — 64px min height */}
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
          Footer buttons use #FFFFFF fill to stand out against the zone background.
          position:fixed at the bottom so it stays visible above the keyboard on iOS. */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          gap: '0.5rem',
          padding: '0 1rem',
          minHeight: ZONE_6_HEIGHT,
          alignItems: 'center',
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
