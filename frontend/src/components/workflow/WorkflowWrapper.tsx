// frontend/src/components/workflow/WorkflowWrapper.tsx

import { ReactNode, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { theme } from '../../styles/theme'

type WorkflowStep = 'photograph' | 'lookup' | 'review'

const STEPS: WorkflowStep[] = ['photograph', 'lookup', 'review']
const STEP_LABELS: Record<WorkflowStep, string> = {
  photograph: 'Photograph',
  lookup: 'Metadata',
  review: 'Review',
}

const ZONE_1_HEIGHT = '3rem'    // step indicator bar
const ZONE_2_HEIGHT = '2.75rem' // controls bar (absent on ReviewStep)
const ZONE_6_HEIGHT = '3rem'    // secondary buttons footer bar

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

  // Track the visual viewport so the container always matches what the user sees.
  // On iOS Safari, opening the keyboard does not resize the layout viewport, so
  // position:fixed children scroll off-screen with the keyboard. The fix is to
  // size our container to window.visualViewport and use normal flex flow for all
  // zones — no position:fixed on any child element.
  const [vpHeight, setVpHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  )
  const [vpOffset, setVpOffset] = useState(
    () => window.visualViewport?.offsetTop ?? 0
  )

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setVpHeight(vv.height)
      setVpOffset(vv.offsetTop)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div
      style={{
        // Pinned to layout viewport top-left; height and translateY track visual viewport
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        maxWidth: '100vw',
        height: vpHeight,
        transform: `translateY(${vpOffset}px)`,
        background: theme.colors.surface,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: theme.font.sans,
      }}
    >
      {/* Zone 1: Step indicator — normal flex child, always at top of container */}
      <div
        style={{
          flexShrink: 0,
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

      {/* Zone 2: Controls bar — normal flex child, only when controls !== null */}
      {hasControls && (
        <div
          style={{
            flexShrink: 0,
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
          flex:1 fills the space between the header zones and Zone 6. */}
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

      {/* Zone 6: Secondary buttons — normal flex child, always at bottom of container.
          Background matches Zone 1 header for visual symmetry. */}
      <div
        style={{
          flexShrink: 0,
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
