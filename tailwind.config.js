/** @type {import('tailwindcss').Config} */
import { themeTokens } from './src/theme/tokens.js';
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arena: themeTokens.colors.arena,
        // Stitch Egyptian UI Kit Design Tokens
        surface: { DEFAULT: themeTokens.colors.surface.card, dim: themeTokens.colors.surface.default, bright: themeTokens.spacing.bright, variant: themeTokens.colors.surface.highest, container: { lowest: themeTokens.colors.surface.lowest, low: themeTokens.colors.surface.low, DEFAULT: themeTokens.colors.surface.card, high: themeTokens.colors.surface.high, highest: themeTokens.colors.surface.highest } },
        'primary-container': themeTokens.colors.primary.container,
        'on-primary-container': themeTokens.colors.primary.onContainer,
        'primary-fixed-dim': themeTokens.spacing.primaryFixedDim,
        'secondary-container': themeTokens.spacing.secondaryContainer,
        'secondary-fixed-dim': themeTokens.spacing.secondaryFixedDim,
        'tertiary-container': themeTokens.spacing.tertiaryContainer,
        'on-surface-variant': themeTokens.spacing.onSurfaceVariant,
        'outline-variant': themeTokens.colors.outline,
      },
      fontFamily: {
        arabic: themeTokens.fonts.arabic,
        rubik: themeTokens.fonts.rubik,
        pixel: themeTokens.fonts.pixel,
      },
      boxShadow: {
        'arcade-cyan': '0 6px 0 #008f97',
        'arcade-red': '0 6px 0 #b32828',
        'arcade-yellow': '0 6px 0 #b39200',
        'arcade-green': '0 6px 0 #009e52',
        'arcade-purple': '0 6px 0 #5b21b6',
        'arcade-dark': '0 6px 0 #06070e',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-short': 'bounce 0.6s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)' },
          '100%': { boxShadow: '0 0 30px rgba(0, 242, 254, 0.9)' },
        }
      }
    },
  },
  plugins: [],
}
