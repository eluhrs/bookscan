import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface ScannerProps {
  onScan: (isbn: string) => void
  active: boolean
}

export default function Scanner({ onScan, active }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const lastScannedRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active || !videoRef.current) return

    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          const text = result.getText()
          if (text === lastScannedRef.current) return
          lastScannedRef.current = text
          onScan(text)
          // Debounce: reset after 3 seconds so same book can be re-scanned
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            lastScannedRef.current = ''
          }, 3000)
        }
        if (err && !(err.message?.includes('No MultiFormat'))) {
          // Ignore "no barcode found" errors — they fire continuously
        }
      })
      .catch(() => setError('Camera access denied. Allow camera permission and reload.'))

    return () => {
      reader.reset()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [active, onScan])

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red', textAlign: 'center' }}>
        {error}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      style={{
        width: '100%',
        maxWidth: 480,
        borderRadius: 8,
        background: '#000',
        display: active ? 'block' : 'none',
      }}
      muted
      playsInline
    />
  )
}
