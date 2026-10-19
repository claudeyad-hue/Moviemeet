/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#07090e',
          900: '#0d1117',
          850: '#121722',
          800: '#171d2b',
          750: '#1e2536',
          700: '#262f44',
          600: '#38435d',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          accent: '#8b5cf6',
          neon: '#a855f7'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(99, 102, 241, 0.25)',
        'glow': '0 0 25px -5px rgba(139, 92, 246, 0.35)',
        'glow-lg': '0 0 40px -10px rgba(139, 92, 246, 0.45)',
        'cinematic': '0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.08)'
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
