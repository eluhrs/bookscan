import { apiFetch } from './client'

export async function login(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password })
  const resp = await fetch('/api/login', {
    method: 'POST',
    body,
  })
  if (!resp.ok) throw new Error('Invalid credentials')
  const data = await resp.json()
  return data.access_token as string
}

export async function getMe(): Promise<{ username: string }> {
  return apiFetch('/api/me')
}
