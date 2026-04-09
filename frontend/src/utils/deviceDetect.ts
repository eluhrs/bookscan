/**
 * Returns true only on genuine mobile devices (phone/tablet).
 * Uses user agent + maxTouchPoints — does not trigger on resized desktop browsers.
 */
export function isMobileDevice(): boolean {
  const ua = navigator.userAgent
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  return mobileUA && navigator.maxTouchPoints > 0
}
