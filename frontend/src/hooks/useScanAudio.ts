import { useRef, useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'

function getOrCreateCtx(ctxRef: MutableRefObject<AudioContext | null>): AudioContext {
  if (!ctxRef.current) {
    ctxRef.current = new AudioContext()
  }
  return ctxRef.current
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
): void {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = freq
  gainNode.gain.setValueAtTime(gain, startTime)
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function useScanAudio() {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      ctxRef.current?.close()
    }
  }, [])

  // Ascending chime — data complete
  const playSuccess = useCallback(() => {
    try {
      const ctx = getOrCreateCtx(ctxRef)
      const t = ctx.currentTime
      playTone(ctx, 880, t, 0.08, 0.4)
      playTone(ctx, 1108, t + 0.08, 0.12, 0.4)
    } catch {
      // Audio not available — silently ignore
    }
  }, [])

  // Descending tone — incomplete data
  const playReview = useCallback(() => {
    try {
      const ctx = getOrCreateCtx(ctxRef)
      const t = ctx.currentTime
      playTone(ctx, 440, t, 0.15, 0.3)
      playTone(ctx, 330, t + 0.15, 0.10, 0.3)
    } catch {
      // Audio not available — silently ignore
    }
  }, [])

  return { playSuccess, playReview }
}
