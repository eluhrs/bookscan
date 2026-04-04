import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    function handle() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  return { isMobile }
}
