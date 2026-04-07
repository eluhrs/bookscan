import { apiFetch } from './client'
import { BookPhoto } from '../types'

export async function uploadPhotos(bookId: string, blobs: Blob[]): Promise<BookPhoto[]> {
  const token = localStorage.getItem('token')
  const form = new FormData()
  blobs.forEach((b, i) => form.append('files', b, `photo_${i}.jpg`))
  const resp = await fetch(`/api/books/${bookId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: form,
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error((detail as { detail?: string }).detail ?? resp.statusText)
  }
  return resp.json() as Promise<BookPhoto[]>
}

export async function listPhotos(bookId: string): Promise<BookPhoto[]> {
  return apiFetch<BookPhoto[]>(`/api/books/${bookId}/photos`)
}

export async function deletePhoto(photoId: string): Promise<void> {
  await apiFetch<void>(`/api/photos/${photoId}`, { method: 'DELETE' })
}

export async function getPhotoUrl(photoId: string): Promise<string> {
  const token = localStorage.getItem('token')
  const resp = await fetch(`/api/photos/${photoId}/file`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!resp.ok) throw new Error('Photo not found')
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}
