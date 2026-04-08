export const theme = {
  colors: {
    bg:        '#FFFFFF',
    surface:   '#FAFAFA',
    border:    '#EAEAEA',
    text:      '#000000',
    muted:     '#666666',
    accent:    '#0070F3',
    danger:    '#E00000',
    scanGreen: '#22C55E',
    warning:   '#F59E0B',
    warningBg:   '#FFFBEB',
    warningText: '#92400E',
    subtle:       '#F5F5F5',   // secondary button bg
    subtleText:   '#333333',   // secondary button text
    disabled:     '#D1D5DB',   // disabled primary button bg
    disabledText: '#9CA3AF',   // disabled primary button text
    zoneBg:       '#F0F0F0',   // step indicator + secondary button bar background
  },
  font: {
    sans: "'Geist', 'Inter', system-ui, sans-serif",
    mono: "'Geist Mono', 'Fira Code', monospace",
  },
  radius: {
    sm: '4px',
    md: '8px',
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.08)',
  },
} as const
