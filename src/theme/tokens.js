// Theme v2 — "Cairo Nights": deep midnight blue, warm gold, sky-blue and rose accents.
export const themeTokens = {
  colors: {
    arena: { dark: '#0C1226', darker: '#070B18', card: '#131B36', cyan: '#4CC9F0', red: '#FF5C7A', yellow: '#FFC857', green: '#3DDC97', purple: '#9B8CFF' },
    surface: { default: '#0F1630', low: '#141C3A', card: '#182244', high: '#1F2A52', highest: '#27335F', lowest: '#0A1024' },
    primary: { container: '#FFC857', onContainer: '#3A2A00' },
    outline: '#2C3A66'
  },
  fonts: {
    arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
    rubik: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
    // The old 8-bit font is retired: numbers and labels use the readable Arabic face.
    pixel: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif']
  },
  spacing: { screen: 'clamp(0.75rem, 2.5vw, 1.5rem)', section: 'clamp(0.75rem, 2vw, 1.25rem)', card: 'clamp(0.75rem, 3vw, 1.75rem)', lowest: '#0A1024', bright: '#2F3B6B', primaryFixedDim: '#FFC857', secondaryContainer: '#4CC9F0', secondaryFixedDim: '#4CC9F0', tertiaryContainer: '#FF9DB0', onSurfaceVariant: '#C5CCE6', fontFamily: 'Cairo, Tajawal, system-ui, sans-serif', pageBackground: '#070B18' },
  direction: 'rtl'
};
