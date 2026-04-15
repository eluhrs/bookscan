import { Database, Sparkles, Loader2 } from 'lucide-react'
import { theme } from '../styles/theme'

type Source =
  | 'open_library'
  | 'google_books'
  | 'library_of_congress'
  | 'ai_generated'
  | 'manual'
  | null
  | undefined

interface Props {
  source: Source
  regenerating?: boolean
  onRegenerate: () => void
}

const CATALOG: Source[] = ['open_library', 'google_books', 'library_of_congress']

export default function DescriptionSourceIcon({ source, regenerating, onRegenerate }: Props) {
  // Show the spinner any time AI generation is in flight, even before a source
  // has been persisted (Review step fires Gemini in parallel with entering the
  // step — source is still null at that moment).
  if (regenerating) {
    return (
      <span aria-label="Regenerating summary" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Loader2 size={14} color={theme.colors.aiPurple} className="ds-spin" />
      </span>
    )
  }
  if (source === 'ai_generated') {
    return (
      <button
        type="button"
        aria-label="Regenerate AI summary"
        onClick={(e) => { e.stopPropagation(); onRegenerate() }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Sparkles size={14} color={theme.colors.aiPurple} />
      </button>
    )
  }
  if (source && CATALOG.includes(source)) {
    return (
      <span aria-label="Catalog source" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Database size={14} color="#888888" />
      </span>
    )
  }
  return null
}
