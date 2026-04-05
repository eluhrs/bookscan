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
        if (videoRef.current) videoRef.current.srcObject = stream
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
        setTorchAvailable(!!caps.torch)
      })
      .catch((e) => {
        setCameraError(`Camera error: ${e instanceof Error ? e.message : String(e)}`)
      })

    return () => {
      // Explicitly turn torch off before releasing track so physical state matches UI on remount
      if (trackRef.current) {
        trackRef.current.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => {})
      }
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

  const buttonLabel = scanning ? 'Scanning…' : isRetry ? 'Retry' : 'Scan'

  if (cameraError) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <p style={{ color: 'red', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>{cameraError}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Row 1: Camera viewfinder — flex: 4 (gets the space reclaimed from the button) */}
      <div style={{ flex: 4, position: 'relative', overflow: 'hidden', background: '#000' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          autoPlay
          muted
          playsInline
        />
        {/* Darkening overlay with transparent targeting rect */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: '10%',
              right: '10%',
              top: torchAvailable ? 58 : 8,
              bottom: 8,
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
        {/* Torch toggle — overlaid top-right corner of viewfinder */}
        {torchAvailable && (
          <button
            onClick={handleTorchToggle}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '0.4rem 0.5rem',
              fontSize: '1.2rem',
              lineHeight: 1,
              background: torchOn ? '#FFD700' : 'rgba(0,0,0,0.5)',
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

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Row 2: Scan button — flex: 2 (~1/3 smaller than before) */}
      <div style={{ flex: 2, display: 'flex', padding: '0.75rem 1rem' }}>
        <button
          onClick={handleScanPress}
          disabled={scanning || !active}
          style={{
            flex: 1,
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: theme.colors.scanGreen,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: scanning ? 'default' : 'pointer',
            opacity: scanning ? 0.7 : 1,
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Row 3: Hint / message text — flex: 3 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1.5rem',
          textAlign: 'center',
        }}
      >
        {scanError ? (
          <p style={{ color: '#ff6b6b', fontSize: '1rem', margin: 0 }}>{scanError}</p>
        ) : (
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            Align barcode within the frame and tap {isRetry ? 'Retry' : 'Scan'}
          </p>
        )}
      </div>
    </div>
  )
}
