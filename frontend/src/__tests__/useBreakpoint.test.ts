import { renderHook, act } from '@testing-library/react'
import { useBreakpoint } from '../hooks/useBreakpoint'

describe('useBreakpoint', () => {
  it('returns isMobile true when window width < 768', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current.isMobile).toBe(true)
  })

  it('returns isMobile false when window width >= 768', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current.isMobile).toBe(false)
  })

  it('updates when window is resized', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current.isMobile).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.isMobile).toBe(true)
  })
})
