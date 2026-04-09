// frontend/src/components/workflow/PhotographStep.tsx

import { useRef, useState, useEffect } from 'react'
import WorkflowWrapper from './WorkflowWrapper'
import { useCameraStream } from '../../hooks/useCameraStream'
import { useScanAudio } from '../../hooks/useScanAudio'
import { theme } from '../../styles/theme'

interface PhotographStepProps {
  photos: File[]
  targetCount: number
  onTargetCountChange: (n: number) => void
  onPhotoAdded: (file: File) => void
  onSkip: () => void
  onCancel: () => void
}

async function captureAndCompress(video: HTMLVideoElement): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    const maxEdge = 1200
    let w = video.videoWidth
    let h = video.videoHeight
    if (w > maxEdge || h > maxEdge) {
      if (w > h) { h = Math.round((h * maxEdge) / w); w = maxEdge }
      else { w = Math.round((w * maxEdge) / h); h = maxEdge }
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Frame capture failed')); return }
        resolve(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.85,
    )
  })
}

export default function PhotographStep({
  photos,
  targetCount,
  onTargetCountChange,
  onPhotoAdded,
  onSkip,
  onCancel,
}: PhotographStepProps) {
  const { videoRef, torchAvailable, torchOn, cameraError, handleTorchToggle } =
    useCameraStream({ enabled: true })
  const { playSuccess } = useScanAudio()
  const capturingRef = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const [squareSide, setSquareSide] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSquareSide(Math.min(width, height) - 24)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  async function handleCapture() {
    if (capturingRef.current || !videoRef.current) return
    if (videoRef.current.videoWidth === 0) return
    capturingRef.current = true
    try {
      const file = await captureAndCompress(videoRef.current)
      playSuccess()
      navigator.vibrate?.(25)
      onPhotoAdded(file)
    } finally {
      capturingRef.current = false
    }
  }

  const isSkipMode = targetCount === 0

  // □/■ progress indicators — hidden when targetCount === 0 (FEAT-06)
  const progressIndicators = isSkipMode ? null : Array.from({ length: targetCount }, (_, i) => (
    <span
      key={i}
      style={{
        fontSize: '1rem',
        color: i < photos.length ? theme.colors.text : theme.colors.muted,
        lineHeight: 1,
      }}
    >
      {i < photos.length ? '■' : '□'}
    </span>
  ))

  // FEAT-05: controls bar has 1px border, interactive controls get subtle background
  const controls = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        border: `1px solid ${theme.colors.controlsBorder}`,
        borderRadius: 8,
        padding: '0.2rem 0.5rem',
      }}
    >
      {/* Left: photo count dropdown — FEAT-06: 0-5 range */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.85rem',
          color: theme.colors.muted,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>#</span>
        <select
          value={targetCount}
          onChange={(e) => onTargetCountChange(Number(e.target.value))}
          style={{
            background: theme.colors.subtle,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 6,
            padding: '0.2rem 0.4rem',
            fontSize: '0.85rem',
            fontFamily: theme.font.sans,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      {/* Center: □/■ progress */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        {progressIndicators}
      </div>

      {/* Right: torch toggle — FEAT-05: already has subtle background */}
      {torchAvailable ? (
        <button
          onClick={handleTorchToggle}
          style={{
            padding: '0.35rem 0.5rem',
            fontSize: '1.1rem',
            lineHeight: 1,
            background: torchOn ? '#FEF08A' : theme.colors.subtle,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            cursor: 'pointer',
          }}
          aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
        >
          🔦
        </button>
      ) : (
        <div style={{ width: '2.25rem' }} />
      )}
    </div>
  )

  const cameraContent = cameraError ? (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <p style={{ color: theme.colors.danger, textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
        {cameraError}
      </p>
    </div>
  ) : (
    <div
      style={{
        height: '100%',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Camera view container with rounded border */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${theme.colors.border}`,
          background: '#000',
        }}
      >
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          autoPlay
          muted
          playsInline
        />

        {/* Square mask overlay — BUG-01: centered square, side = min(containerW, containerH) - 24px */}
        {squareSide > 0 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                width: squareSide,
                height: squareSide,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                borderRadius: 4,
              }}
            >
              {/* Blue corner brackets */}
              <div style={{ position: 'absolute', top: -2, left: -2, width: 22, height: 22, borderTop: `3px solid ${theme.colors.accent}`, borderLeft: `3px solid ${theme.colors.accent}`, borderRadius: '2px 0 0 0' }} />
              <div style={{ position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderTop: `3px solid ${theme.colors.accent}`, borderRight: `3px solid ${theme.colors.accent}`, borderRadius: '0 2px 0 0' }} />
              <div style={{ position: 'absolute', bottom: -2, left: -2, width: 22, height: 22, borderBottom: `3px solid ${theme.colors.accent}`, borderLeft: `3px solid ${theme.colors.accent}`, borderRadius: '0 0 0 2px' }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderBottom: `3px solid ${theme.colors.accent}`, borderRight: `3px solid ${theme.colors.accent}`, borderRadius: '0 0 2px 0' }} />

              {/* Hint text: bottom-aligned inside mask */}
              <div style={{ position: 'absolute', bottom: 12, left: 8, right: 8, textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 20,
                  }}
                >
                  Set number of images, position book, then Capture
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <WorkflowWrapper
      step="photograph"
      controls={controls}
      primaryLabel={isSkipMode ? 'SKIP' : 'CAPTURE'}
      onPrimary={isSkipMode ? onSkip : handleCapture}
      onCancel={onCancel}
    >
      {cameraContent}
    </WorkflowWrapper>
  )
}
