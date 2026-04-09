// frontend/src/components/workflow/LookupStep.tsx

import { useRef, useState, useEffect } from 'react'
import { Camera, Keyboard, Flashlight } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import WorkflowWrapper from './WorkflowWrapper'
import { lookupIsbn } from '../../api/books'
import { useScanAudio } from '../../hooks/useScanAudio'
import { useCameraStream } from '../../hooks/useCameraStream'
import { BookLookup } from '../../types'
import { theme } from '../../styles/theme'

// --- Verbatim decode crop strategies from Scanner.tsx — do not simplify ---
const CROP_STRATEGIES = [
  { srcW: 0.8,  srcH: 0.4,  zoom: 1 },
  { srcW: 0.95, srcH: 0.25, zoom: 1 },
  { srcW: 0.5,  srcH: 0.3,  zoom: 2 },
]
// --------------------------------------------------------------------------

type LookupMode = 'camera' | 'keyboard'

interface LookupStepProps {
  onLookupComplete: (result: BookLookup) => void
  onCancel: () => void
}

export default function LookupStep({ onLookupComplete, onCancel }: LookupStepProps) {
  const [mode, setMode] = useState<LookupMode>('camera')
  const [isbn, setIsbn] = useState('')
  const [looking, setLooking] = useState(false)
  const [hintError, setHintError] = useState<string | null>(null)
  const [viewportHeight, setViewportHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (mode !== 'keyboard') {
      setViewportHeight(undefined)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => setViewportHeight(vv.height)
    vv.addEventListener('resize', handler)
    setViewportHeight(vv.height)
    return () => vv.removeEventListener('resize', handler)
  }, [mode])

  const { videoRef, canvasRef, torchAvailable, torchOn, cameraError, handleTorchToggle } =
    useCameraStream({ enabled: mode === 'camera' })

  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader()

  const { playReview } = useScanAudio()

  // --- Verbatim decode logic from Scanner.tsx ---
  async function handleCameraLookup() {
    if (looking || !videoRef.current || !canvasRef.current || !readerRef.current) return
    setLooking(true)
    setHintError(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      const vw = video.videoWidth
      const vh = video.videoHeight

      for (const { srcW, srcH, zoom } of CROP_STRATEGIES) {
        const sw = Math.round(vw * srcW)
        const sh = Math.round(vh * srcH)
        const sx = Math.round((vw - sw) / 2)
        const sy = Math.round((vh - sh) / 2)
        canvas.width = Math.round(sw * zoom)
        canvas.height = Math.round(sh * zoom)
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        try {
          const result = readerRef.current.decodeFromCanvas(canvas)
          await submitIsbn(result.getText())
          return
        } catch {
          // Try next strategy
        }
      }

      // All strategies failed
      playReview()
      navigator.vibrate?.(25)
      setHintError('No barcode found — try again')
    } finally {
      setLooking(false)
    }
  }
  // -----------------------------------------------

  async function handleKeyboardLookup() {
    if (!isbn.trim() || looking) return
    setLooking(true)
    setHintError(null)
    try {
      await submitIsbn(isbn.trim())
    } finally {
      setLooking(false)
    }
  }

  async function submitIsbn(isbnValue: string) {
    try {
      const result = await lookupIsbn(isbnValue)
      onLookupComplete(result)
    } catch (e) {
      playReview()
      navigator.vibrate?.(25)
      setHintError(e instanceof Error ? e.message : 'Lookup failed — try again')
    }
  }

  const cameraControls = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <button
        aria-label="Switch to keyboard input"
        onClick={() => { setMode('keyboard'); setHintError(null) }}
        style={{
          background: theme.colors.subtle,
          border: `1px solid ${theme.colors.controlsBorder}`,
          color: theme.colors.text,
          cursor: 'pointer',
          padding: '0.35rem 0.5rem',
          borderRadius: 8,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Switch to keyboard"
      >
        <Keyboard size={18} />
      </button>
      {torchAvailable && (
        <button
          onClick={handleTorchToggle}
          style={{
            padding: '0.35rem 0.5rem',
            lineHeight: 1,
            background: torchOn ? '#FEF08A' : theme.colors.subtle,
            border: `1px solid ${torchOn ? '#B8A800' : theme.colors.controlsBorder}`,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: torchOn ? '#5a4500' : theme.colors.text,
          }}
          aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
        >
          <Flashlight size={18} />
        </button>
      )}
    </div>
  )

  const keyboardControls = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <button
        aria-label="Switch to camera"
        onClick={() => { setMode('camera'); setHintError(null) }}
        style={{
          background: theme.colors.subtle,
          border: `1px solid ${theme.colors.controlsBorder}`,
          color: theme.colors.text,
          cursor: 'pointer',
          padding: '0.35rem 0.5rem',
          borderRadius: 8,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Switch to camera"
      >
        <Camera size={18} />
      </button>
    </div>
  )

  const hintText = hintError ?? undefined

  const mainContent = mode === 'camera' ? (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {cameraError ? (
        <p style={{ color: theme.colors.danger, textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
          {cameraError}
        </p>
      ) : (
        <div
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
          {/* Landscape targeting mask */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: '5%',
                right: '5%',
                top: '32%',
                bottom: '32%',
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
              <div style={{ position: 'absolute', bottom: 10, left: 8, right: 8, textAlign: 'center' }}>
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
                  Align barcode then tap Lookup, or use keyboard
                </span>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  ) : (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <style>{`.isbn-input::placeholder { color: #6B7280; font-size: 0.82rem; }`}</style>
      <input
        className="isbn-input"
        type="text"
        inputMode="numeric"
        placeholder="Type ISBN-10 or ISBN-13, then tap Lookup"
        value={isbn}
        onChange={(e) => setIsbn(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '0.75rem 1rem',
          fontSize: '1.1rem',
          background: '#fff',
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 8,
          outline: 'none',
          textAlign: 'center',
          fontFamily: theme.font.sans,
        }}
      />
    </div>
  )

  return (
    <WorkflowWrapper
      step="lookup"
      controls={mode === 'camera' ? cameraControls : keyboardControls}
      hintText={hintText}
      primaryLabel={looking ? 'Looking up…' : 'LOOKUP'}
      primaryDisabled={looking}
      onPrimary={mode === 'camera' ? handleCameraLookup : handleKeyboardLookup}
      onCancel={onCancel}
      viewportHeight={mode === 'keyboard' ? viewportHeight : undefined}
    >
      {mainContent}
    </WorkflowWrapper>
  )
}
