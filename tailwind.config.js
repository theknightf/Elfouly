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
        surface: { DEFAULT: themeTokens.colors.surface.card, dim: themeTokens.colors.surface.default, bright: '#3b3650', variant: themeTokens.colors.surface.highest, container: { lowest: '#0f0a22', low: themeTokens.colors.surface.low, DEFAULT: themeTokens.colors.surface.card, high: themeTokens.colors.surface.high, highest: themeTokens.colors.surface.highest } },
        'primary-container': themeTokens.colors.primary.container,
        'on-primary-container': themeTokens.colors.primary.onContainer,
        'primary-fixed-dim': '#ffba20',
        'secondary-container': '#00e3fd',
        'secondary-fixed-dim': '#00daf3',
        'tertiary-container': '#ffb0b3',
        'on-surface-variant': '#d5c4ab',
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
