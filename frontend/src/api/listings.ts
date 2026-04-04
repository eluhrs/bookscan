import { apiFetch } from './client'
import { Listing } from '../types'

export async function generateListing(bookId: string): Promise<Listing> {
  return apiFetch(`/api/books/${bookId}/listings`, { method: 'POST' })
}

export async function getBookListings(bookId: string): Promise<Listing[]> {
  return apiFetch(`/api/books/${bookId}/listings`)
}

export async function getAllListings(): Promise<Listing[]> {
  return apiFetch('/api/listings')
}
