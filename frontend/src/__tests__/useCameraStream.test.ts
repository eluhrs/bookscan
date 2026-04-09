import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import { useCameraStream } from '../hooks/useCameraStream'

// Capture the 'ended' callback registered on the track
let trackEndedCallback: (() => void) | null = null

const mockTrack = {
  getCapabilities: () => ({ torch: false }),
  applyConstraints: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  readyState: 'live' as MediaStreamTrackState,
  addEventListener: vi.fn((event: string, cb: () => void) => {
    if (event === 'ended') trackEndedCallback = cb
  }),
  removeEventListener: vi.fn(),
}

const mockStream = {
  getVideoTracks: () => [mockTrack],
  getTracks: () => [mockTrack],
}

let getUserMediaMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  trackEndedCallback = null
  mockTrack.readyState = 'live'
  mockTrack.stop.mockClear()
  mockTrack.addEventListener.mockClear()
  getUserMediaMock = vi.fn().mockResolvedValue(mockStream)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    writable: true,
    configurable: true,
  })
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
    configurable: true,
  })
})

describe('useCameraStream', () => {
  it('calls getUserMedia when enabled', async () => {
    renderHook(() => useCameraStream({ enabled: true }))
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(1))
  })

  it('does not call getUserMedia when disabled', async () => {
    renderHook(() => useCameraStream({ enabled: false }))
    await new Promise((r) => setTimeout(r, 50))
    expect(getUserMediaMock).not.toHaveBeenCalled()
  })

  it('restarts stream when track emits ended event', async () => {
    renderHook(() => useCameraStream({ enabled: true }))
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(1))

    act(() => {
      trackEndedCallback?.()
    })

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(2))
  })

  it('restarts stream on visibilitychange when track.readyState is ended', async () => {
    renderHook(() => useCameraStream({ enabled: true }))
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(1))

    mockTrack.readyState = 'ended'

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(2))
  })

  it('does not restart stream on visibilitychange when track is still live', async () => {
    renderHook(() => useCameraStream({ enabled: true }))
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(1))

    mockTrack.readyState = 'live'

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(getUserMediaMock).toHaveBeenCalledTimes(1)
  })
})
