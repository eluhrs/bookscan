import { apiFetch } from './client'

export interface ExportBatch {
  id: number
  exported_at: string
  book_ids: string[]
  count: number
}

export async function exportBooks(): Promise<void> {
  const token = localStorage.getItem('token')
  const resp = await fetch('/api/exports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!resp.ok) throw new Error('Export failed')
  const blob = await resp.blob()
  const disposition = resp.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="(.+)"/)
  const now = new Date()
  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
  const filename = match ? match[1] : `bookscan-export-${ts}.csv`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function getExportBatch(): Promise<ExportBatch | null> {
  return apiFetch<ExportBatch | null>('/api/exports/batch')
}

export async function undoExportBatch(): Promise<void> {
  await apiFetch('/api/exports/batch/undo', { method: 'POST' })
}

export async function dismissExportBatch(): Promise<void> {
  await apiFetch('/api/exports/batch', { method: 'DELETE' })
}
