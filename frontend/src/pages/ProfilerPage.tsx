import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flashlight } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { useCameraStream } from '../hooks/useCameraStream'
import { useScanAudio } from '../hooks/useScanAudio'
import { apiFetch } from '../api/client'
import { theme } from '../styles/theme'

const CROP_STRATEGIES = [
  { srcW: 0.8,  srcH: 0.4,  zoom: 1 },
  { srcW: 0.95, srcH: 0.25, zoom: 1 },
  { srcW: 0.5,  srcH: 0.3,  zoom: 2 },
]

export default function ProfilerPage() {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState(0)

  const { videoRef, canvasRef, torchAvailable, torchOn, handleTorchToggle } =
    useCameraStream({ enabled: true })

  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader()

  const { playSuccess, playReview } = useScanAudio()

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(null), 1500)
  }

  async function handleScan() {
    if (scanning || !videoRef.current || !canvasRef.current || !readerRef.current) return
    setScanning(true)

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
          const isbn = result.getText()
          if (!isbn.startsWith('978') && !isbn.startsWith('979')) {
            playReview()
            showMessage('Not a book ISBN')
            return
          }
          const resp = await apiFetch<{ status: string }>('/api/profiler/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isbn }),
          })
          setSessionCount(c => c + 1)
          navigator.vibrate?.(25)
          if (resp?.status === 'duplicate') {
            playReview()
            showMessage(`Already scanned: ${isbn}`)
          } else {
            playSuccess()
            showMessage(`Saved: ${isbn}`)
          }
          return
        } catch {
          // Try next strategy
        }
      }

      playReview()
      navigator.vibrate?.(25)
      showMessage('No barcode found')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
    }}>
      {/* Navbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        background: theme.colors.navBg,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', color: theme.colors.text, fontFamily: theme.font.sans,
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: theme.colors.text }}>
          ISBN Profiler
        </span>
        <span style={{ fontSize: '0.85rem', color: theme.colors.secondaryText }}>
          {sessionCount} scanned
        </span>
      </div>

      {/* Camera */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Message overlay */}
        {message && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            borderRadius: 8,
            fontSize: '1rem',
            fontFamily: theme.font.sans,
            whiteSpace: 'nowrap',
          }}>
            {message}
          </div>
        )}

        {/* Torch toggle */}
        {torchAvailable && (
          <button
            onClick={handleTorchToggle}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              background: torchOn ? theme.colors.primaryBlue : 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <Flashlight size={18} />
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.75rem 1rem',
        background: theme.colors.navBg,
        flexShrink: 0,
      }}>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            width: '100%',
            height: 64,
            background: theme.colors.primaryBlue,
            color: '#fff',
            border: 'none',
            borderRadius: theme.radius.md,
            fontSize: '1rem',
            fontWeight: 600,
            fontFamily: theme.font.sans,
            cursor: scanning ? 'default' : 'pointer',
            opacity: scanning ? 0.7 : 1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {scanning ? 'Scanning...' : 'SCAN'}
        </button>
      </div>
    </div>
  )
}
