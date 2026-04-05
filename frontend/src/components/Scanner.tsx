import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface ScannerProps {
  onScan: (isbn: string) => void
  active: boolean
  isRetry?: boolean
}

export default function Scanner({ onScan, active, isRetry }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return

    if (!navigator.mediaDevices) {
      setCameraError('Camera requires HTTPS. Open https://<your-mac-ip>:3001 on your phone.')
      return
    }

    readerRef.current = new BrowserMultiFormatReader()

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
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
    }
  }, [active])

  async function handleScanPress() {
    if (scanning || !videoRef.current || !canvasRef.current || !readerRef.current) return
    setScanning(true)
    setScanError(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const vw = video.videoWidth
      const vh = video.videoHeight

      // Match targeting rect: 80% width, 40% height, centered
      const rw = Math.round(vw * 0.8)
      const rh = Math.round(vh * 0.4)
      const rx = Math.round((vw - rw) / 2)
      const ry = Math.round((vh - rh) / 2)

      canvas.width = rw
      canvas.height = rh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, rx, ry, rw, rh, 0, 0, rw, rh)

      const result = readerRef.current.decodeFromCanvas(canvas)
      onScan(result.getText())
    } catch {
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
        {/* Darkening overlay with transparent targeting rect */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
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
            {/* Corner markers */}
            <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '3px solid #0070F3', borderLeft: '3px solid #0070F3' }} />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '3px solid #0070F3', borderRight: '3px solid #0070F3' }} />
            <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '3px solid #0070F3', borderLeft: '3px solid #0070F3' }} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '3px solid #0070F3', borderRight: '3px solid #0070F3' }} />
          </div>
        </div>
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Scan button */}
      <button
        onClick={handleScanPress}
        disabled={scanning || !active}
        style={{
          display: 'block',
          width: '100%',
          padding: '1rem',
          marginTop: '0.75rem',
          fontSize: '1.1rem',
          fontWeight: 600,
          background: '#22C55E',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: scanning ? 'default' : 'pointer',
          opacity: scanning ? 0.7 : 1,
        }}
      >
        {buttonLabel}
      </button>

      {scanError && (
        <p style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          {scanError}
        </p>
      )}
    </div>
  )
}
