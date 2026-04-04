import { useState, useCallback } from 'react'
import { login as apiLogin } from '../api/auth'

export function useAuth() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token')
  )

  const login = useCallback(async (username: string, password: string) => {
    const t = await apiLogin(username, password)
    localStorage.setItem('token', t)
    setToken(t)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
  }, [])

  return { token, isAuthenticated: !!token, login, logout }
}
