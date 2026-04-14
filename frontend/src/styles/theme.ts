export const theme = {
  colors: {
    bg:        '#FFFFFF',
    surface:   '#FFFFFF',        // was #FAFAFA
    border:    '#E0E0E0',
    text:      '#000000',
    muted:     '#666666',
    accent:    '#0070F3',
    danger:    '#E00000',
    scanGreen: '#22C55E',
    warning:   '#F59E0B',
    warningBg:   '#FFFBEB',
    warningText: '#92400E',
    subtle:         '#F4F4F4',   // was #F5F5F5 — toolbar button fill
    subtleText:     '#333333',
    disabled:       '#D0D0D0',   // was #D1D5DB
    disabledText:   '#909090',   // was #9CA3AF
    zoneBg:         '#E0E0E0',   // was #F0F0F0 — header + footer zones
    controlsBorder: '#CCCCCC',   // was #E5E5E5 — individual button borders
    footerButtonBg: '#FFFFFF',   // NEW — Dashboard / Start Over button fill
    navBg:          '#E0E0E0',   // navbar/footer zones
    tableHeaderBg:  '#F5F5F5',   // table header + filmstrip backgrounds
    rowBorder:      '#F0F0F0',   // row separators inside the table
    zoneBorder:     '#CCCCCC',   // content zone L/R borders + button borders
    secondaryText:  '#666666',   // secondary button text
    primaryBlue:    '#0070F3',
    reviewGreen:    '#3B6D11',
  },
  font: {
    sans: "'Geist', 'Inter', system-ui, sans-serif",
    mono: "'Geist Mono', 'Fira Code', monospace",
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.08)',
  },
} as const
