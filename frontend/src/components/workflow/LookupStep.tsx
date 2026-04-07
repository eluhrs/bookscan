import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import WorkflowWrapper from './WorkflowWrapper'
import { lookupIsbn } from '../../api/books'
import { useScanAudio } from '../../hooks/useScanAudio'
import { BookLookup } from '../../types'
import { theme } from '../../styles/theme'

// --- Verbatim from Scanner.tsx — do not simplify ---
let persistedTorchOn = false

const CROP_STRATEGIES = [
  { srcW: 0.8,  srcH: 0.4,  zoom: 1 },
  { srcW: 0.95, srcH: 0.25, zoom: 1 },
  { srcW: 0.5,  srcH: 0.3,  zoom: 2 },
]
// ---------------------------------------------------

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
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(persistedTorchOn)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  const { playReview } = useScanAudio()

  // --- Verbatim camera setup from Scanner.tsx ---
  useEffect(() => {
    if (mode !== 'camera') return

    if (!navigator.mediaDevices) {
      setCameraError('Camera requires HTTPS.')
      return
    }

    readerRef.current = new BrowserMultiFormatReader()

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
        const hasTorch = !!caps.torch
        setTorchAvailable(hasTorch)
        if (persistedTorchOn && hasTorch) {
          track.applyConstraints({ advanced: [{ torch: true } as any] }).catch(() => {})
        } else if (persistedTorchOn && !hasTorch) {
          persistedTorchOn = false
          setTorchOn(false)
        }
      })
      .catch((e) => {
        setCameraError(`Camera error: ${e instanceof Error ? e.message : String(e)}`)
      })

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      trackRef.current = null
      setTorchAvailable(false)
      // torchOn state intentionally NOT reset — persistedTorchOn handles restoration on remount
    }
  }, [mode])
  // -----------------------------------------------

  async function handleTorchToggle() {
    if (!trackRef.current) return
    const next = !torchOn
    persistedTorchOn = next
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as any] })
      setTorchOn(next)
    } catch {
      persistedTorchOn = torchOn
    }
  }

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
      setHintError(e instanceof Error ? e.message : 'Lookup failed — try again')
    }
  }

  const cameraControls = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <button
        aria-label="Switch to keyboard input"
        onClick={() => { setMode('keyboard'); setHintError(null) }}
        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.3rem', padding: '0.25rem' }}
      >
        ⌨
      </button>
      {torchAvailable && (
        <button
          onClick={handleTorchToggle}
          style={{
            padding: '0.4rem 0.5rem',
            fontSize: '1.2rem',
            lineHeight: 1,
            background: torchOn ? '#FFD700' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
        >
          🔦
        </button>
      )}
    </div>
  )

  const keyboardControls = (
    <button
      aria-label="Switch to camera"
      onClick={() => { setMode('camera'); setHintError(null) }}
      style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.3rem', padding: '0.25rem' }}
    >
      📷
    </button>
  )

  const hintText = hintError
    ? hintError
    : mode === 'camera'
      ? 'Align barcode and tap Lookup, or use keyboard'
      : 'Type ISBN-10 or ISBN-13'

  const mainContent = mode === 'camera' ? (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <p style={{ color: 'red', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>{cameraError}</p>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            autoPlay
            muted
            playsInline
          />
          {/* Targeting mask — verbatim from Scanner.tsx */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                left: '10%',
                right: '10%',
                top: '25%',
                bottom: '25%',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: `3px solid ${theme.colors.accent}`, borderLeft: `3px solid ${theme.colors.accent}` }} />
              <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: `3px solid ${theme.colors.accent}`, borderRight: `3px solid ${theme.colors.accent}` }} />
              <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: `3px solid ${theme.colors.accent}`, borderLeft: `3px solid ${theme.colors.accent}` }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: `3px solid ${theme.colors.accent}`, borderRight: `3px solid ${theme.colors.accent}` }} />
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ padding: '0.75rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: hintError ? '#ff6b6b' : '#666', fontSize: '0.9rem', margin: 0 }}>
          {hintText}
        </p>
      </div>
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
        gap: '1rem',
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        placeholder="Enter ISBN-10 or ISBN-13"
        value={isbn}
        onChange={(e) => setIsbn(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '0.75rem 1rem',
          fontSize: '1.1rem',
          background: '#111',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: 8,
          outline: 'none',
          textAlign: 'center',
          fontFamily: 'inherit',
        }}
      />
      <p style={{ color: hintError ? '#ff6b6b' : '#666', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
        {hintText}
      </p>
    </div>
  )

  return (
    <WorkflowWrapper
      step="lookup"
      controls={mode === 'camera' ? cameraControls : keyboardControls}
      primaryLabel={looking ? 'Looking up…' : 'LOOKUP'}
      primaryDisabled={looking}
      onPrimary={mode === 'camera' ? handleCameraLookup : handleKeyboardLookup}
      onCancel={onCancel}
    >
      {mainContent}
    </WorkflowWrapper>
  )
}
