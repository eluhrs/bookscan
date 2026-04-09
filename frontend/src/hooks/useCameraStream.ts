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

/** Samples a 16×16 downscale of the video to detect a black frame. */
function sampleIsBlack(video: HTMLVideoElement): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(video, 0, 0, 16, 16)
  const data = ctx.getImageData(0, 0, 16, 16).data
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] + data[i + 1] + data[i + 2]
  }
  // avg luminance < 5/255 → essentially black
  return sum / ((data.length / 4) * 3) < 5
}

export function useCameraStream({ enabled }: UseCameraStreamOptions): UseCameraStreamReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(persistedTorchOn)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // restartRef holds a reference to the current startStream function so that
  // event handlers registered asynchronously (track 'ended', visibilitychange)
  // can call the latest version of startStream even from inside a closure.
  const restartRef = useRef<(() => void) | null>(null)
  const blackFrameCountRef = useRef(0)
  const blackCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (!navigator.mediaDevices) {
      setCameraError('Camera requires HTTPS.')
      return
    }

    setCameraError(null)
    let cancelled = false

    function stopCurrentStream() {
      if (blackCheckIntervalRef.current !== null) {
        clearInterval(blackCheckIntervalRef.current)
        blackCheckIntervalRef.current = null
      }
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream
        s.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      trackRef.current = null
    }

    function startStream() {
      if (cancelled) return
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
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          if (videoRef.current) videoRef.current.srcObject = stream
          const track = stream.getVideoTracks()[0]
          trackRef.current = track
          blackFrameCountRef.current = 0

          // Recovery: restart automatically if the OS kills the track
          track.addEventListener('ended', () => {
            if (!cancelled) {
              stopCurrentStream()
              restartRef.current?.()
            }
          })

          const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
          const hasTorch = !!caps.torch
          setTorchAvailable(hasTorch)
          if (persistedTorchOn && hasTorch) {
            track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }).catch(() => {})
          } else if (persistedTorchOn && !hasTorch) {
            persistedTorchOn = false
            setTorchOn(false)
          }

          // Black frame detector: sample every 2s; 5 consecutive black frames
          // (~10s total) triggers a stream restart. Avoids false positives during
          // normal camera initialization.
          blackCheckIntervalRef.current = setInterval(() => {
            if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return
            if (sampleIsBlack(videoRef.current)) {
              blackFrameCountRef.current++
              if (blackFrameCountRef.current >= 5) {
                blackFrameCountRef.current = 0
                stopCurrentStream()
                restartRef.current?.()
              }
            } else {
              blackFrameCountRef.current = 0
            }
          }, 2000)
        })
        .catch((e) => {
          if (!cancelled) {
            setCameraError(`Camera error: ${e instanceof Error ? e.message : String(e)}`)
          }
        })
    }

    // Keep restartRef current so async handlers always call the right startStream
    restartRef.current = startStream

    // Recovery: restart if the app returns to foreground with a dead stream
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const track = trackRef.current
        if (!track || track.readyState === 'ended') {
          stopCurrentStream()
          restartRef.current?.()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    startStream()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopCurrentStream()
      setTorchAvailable(false)
      // torchOn state intentionally NOT reset — persistedTorchOn handles restoration on remount
    }
  }, [enabled])

  async function handleTorchToggle() {
    if (!trackRef.current) return
    const next = !torchOn
    persistedTorchOn = next
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      persistedTorchOn = torchOn
    }
  }

  return { videoRef, canvasRef, torchAvailable, torchOn, cameraError, handleTorchToggle }
}
