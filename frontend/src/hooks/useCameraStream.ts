// frontend/src/hooks/useCameraStream.ts

import { useEffect, useRef, useState } from 'react'

// Module-level: persists torch state across component remounts.
// Shared by all camera users — only one camera is ever active at a time.
let persistedTorchOn = false

interface UseCameraStreamOptions {
  /** When false the hook does nothing (camera stays off). Changing enabled re-runs setup. */
  enabled: boolean
}

interface UseCameraStreamReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  torchAvailable: boolean
  torchOn: boolean
  cameraError: string | null
  handleTorchToggle: () => Promise<void>
}

export function useCameraStream({ enabled }: UseCameraStreamOptions): UseCameraStreamReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(persistedTorchOn)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (!navigator.mediaDevices) {
      setCameraError('Camera requires HTTPS.')
      return
    }

    // Reset error from any previous attempt
    setCameraError(null)

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
  }, [enabled])

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

  return { videoRef, canvasRef, torchAvailable, torchOn, cameraError, handleTorchToggle }
}
