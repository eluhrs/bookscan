export interface Book {
  id: string
  isbn: string
  title: string | null
  author: string | null
  publisher: string | null
  edition: string | null
  year: number | null
  pages: number | null
  dimensions: string | null
  weight: string | null
  description: string | null
  condition: string | null
  cover_image_url: string | null
  cover_image_local: string | null
  data_sources: Record<string, string> | null
  data_complete: boolean
  has_photos: boolean
  needs_photo_review: boolean
  created_at: string
  updated_at: string
}

export interface BookPhoto {
  id: string
  book_id: string
  filename: string
  created_at: string
}

export interface BookLookup {
  isbn: string
  title: string | null
  author: string | null
  publisher: string | null
  edition: string | null
  year: number | null
  pages: number | null
  dimensions: string | null
  weight: string | null
  description: string | null
  condition: string | null
  cover_image_url: string | null
  data_sources: Record<string, string> | null
  data_complete: boolean
}

export interface Listing {
  id: string
  book_id: string
  listing_text: string
  created_at: string
  ebay_listing_id: string | null
  ebay_status: string
}

export interface BookListResponse {
  items: Book[]
  total: number
  page: number
  page_size: number
}
