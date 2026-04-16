const getToken = () => localStorage.getItem('token')

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }
  const resp = await fetch(path, { ...options, headers })

  // Swap in refreshed token if the server issued one
  const refreshToken = resp.headers.get('X-Refresh-Token')
  if (refreshToken) {
    localStorage.setItem('token', refreshToken)
  }

  if (resp.status === 401) {
    localStorage.removeItem('token')
    sessionStorage.setItem('session_expired', '1')
    window.location.href = '/login'
    return new Promise(() => {})
  }

  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(detail.detail ?? resp.statusText)
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}
