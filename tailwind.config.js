/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          dark: '#0F1026',
          darker: '#090A17',
          card: '#181A3A',
          cyan: '#00F2FE',
          red: '#FF4B4B',
          yellow: '#FFD200',
          green: '#00E676',
          purple: '#8B5CF6',
          pink: '#EC4899',
        }
      },
      fontFamily: {
        arabic: ['"Tajawal"', '"Readex Pro"', '"Cairo"', 'system-ui', 'sans-serif'],
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
