import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { theme } from '../styles/theme'

interface ScannerProps {
  onScan: (isbn: string) => void
  onScanFail?: () => void
  active: boolean
  isRetry?: boolean
}

// Three crop strategies tried in order per button press.
// Each describes the source rect as a fraction of the video frame.
// Strategy 3 digitally zooms the center to help cameras that need distance to focus.
const CROP_STRATEGIES = [
  { srcW: 0.8,  srcH: 0.4,  zoom: 1 },   // standard: 80% × 40%, 1:1
  { srcW: 0.95, srcH: 0.25, zoom: 1 },   // wide strip: full width, narrow band
  { srcW: 0.5,  srcH: 0.3,  zoom: 2 },   // center zoom: 50% × 30% stretched 2×
]

export default function Scanner({ onScan, onScanFail, active, isRetry }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    if (!active) return

    if (!navigator.mediaDevices) {
      setCameraError('Camera requires HTTPS. Open https://<your-mac-ip>:3001 on your phone.')
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        // Check torch support (typed as any — torch is not in standard TS types)
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
        setTorchAvailable(!!caps.torch)
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
      setTorchOn(false)
      setTorchAvailable(false)
    }
  }, [active])

  async function handleTorchToggle() {
    if (!trackRef.current) return
    const next = !torchOn
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as any] })
      setTorchOn(next)
    } catch {
      // Torch not supported on this device despite capability report — ignore
    }
  }

  async function handleScanPress() {
    if (scanning || !videoRef.current || !canvasRef.current || !readerRef.current) return
    setScanning(true)
    setScanError(null)

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
          onScan(result.getText())
          return
        } catch {
          // Try next strategy
        }
      }

      // All strategies failed
      onScanFail?.()
      setScanError('No barcode found — try again')
    } finally {
      setScanning(false)
    }
  }

  if (cameraError) {
    return (
      <div style={{ padding: '1rem', color: 'red', textAlign: 'center' }}>
        {cameraError}
      </div>
    )
  }

  const buttonLabel = scanning ? 'Scanning…' : isRetry ? 'Retry' : 'Scan'

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      {/* Viewfinder + overlay */}
      <div style={{ position: 'relative', display: 'block', lineHeight: 0 }}>
        <video
          ref={videoRef}
          style={{ width: '100%', display: active ? 'block' : 'none', background: '#000' }}
          autoPlay
          muted
          playsInline
        />
        {/* Darkening overlay with transparent targeting rect matching strategy 1 crop */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: '10%',
              right: '10%',
              top: '30%',
              bottom: '30%',
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

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Controls row: torch toggle (when available) + scan button */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        {torchAvailable && (
          <button
            onClick={handleTorchToggle}
            style={{
              padding: '1rem',
              fontSize: '1.3rem',
              background: torchOn ? '#FFD700' : 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
          >
            🔦
          </button>
        )}
        <button
          onClick={handleScanPress}
          disabled={scanning || !active}
          style={{
            flex: 1,
            padding: '1rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            background: theme.colors.scanGreen,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: scanning ? 'default' : 'pointer',
            opacity: scanning ? 0.7 : 1,
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {scanError && (
        <p style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          {scanError}
        </p>
      )}
    </div>
  )
}
