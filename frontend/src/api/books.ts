import { apiFetch } from './client'
import { Book, BookLookup, BookListResponse } from '../types'

export async function lookupIsbn(isbn: string): Promise<BookLookup> {
  return apiFetch(`/api/books/lookup/${encodeURIComponent(isbn)}`)
}

export async function saveBook(
  book: Omit<Book, 'id' | 'cover_image_local' | 'created_at' | 'updated_at'>
): Promise<Book> {
  return apiFetch('/api/books', { method: 'POST', body: JSON.stringify(book) })
}

export async function listBooks(params?: {
  page?: number
  page_size?: number
  incomplete_only?: boolean
  search?: string
}): Promise<BookListResponse> {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.page_size) q.set('page_size', String(params.page_size))
  if (params?.incomplete_only) q.set('incomplete_only', 'true')
  if (params?.search) q.set('search', params.search)
  return apiFetch(`/api/books?${q}`)
}

export async function updateBook(id: string, update: Partial<Book>): Promise<Book> {
  return apiFetch(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify(update) })
}

export async function deleteBook(id: string): Promise<void> {
  await apiFetch(`/api/books/${id}`, { method: 'DELETE' })
}

export async function exportListingsCSV(): Promise<void> {
  const token = localStorage.getItem('token')
  const resp = await fetch('/api/listings?format=csv', {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!resp.ok) throw new Error('Export failed')
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'listings.csv'
  a.click()
  URL.revokeObjectURL(url)
}
