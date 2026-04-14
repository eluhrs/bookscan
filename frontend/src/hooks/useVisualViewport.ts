import { useState, useEffect } from 'react'

// Tracks window.visualViewport so a position:fixed container can size itself
// to the visible viewport. On iOS Safari the URL bar and on-screen keyboard
// shrink the visual viewport without shrinking the layout viewport, so plain
// 100vh does not keep fixed footers on-screen. Using this hook lets a pinned
// container stay exactly as tall as the user actually sees.
//
// In jsdom window.visualViewport is undefined; we fall back to window.innerHeight
// and zero offset and skip listener attachment.
export function useVisualViewport() {
  const [height, setHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  )
  const [offsetTop, setOffsetTop] = useState(
    () => window.visualViewport?.offsetTop ?? 0
  )

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setHeight(vv.height)
      setOffsetTop(vv.offsetTop)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return { height, offsetTop }
}
