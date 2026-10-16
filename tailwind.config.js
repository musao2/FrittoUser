/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FRITTO brend rangi (sariq #FCA914). Kodda "emerald-*" nomi bilan ishlatiladi:
        //   600 — tugma foni (ustida qora yozuv), 700/800 — matn va ikonkalar (oq fonda yaxshi o'qiladi)
        emerald: {
          50:  '#FFF8E6',
          100: '#FFEFC2',
          200: '#FFDF8A',
          300: '#FECB4D',
          400: '#FDB92A',
          500: '#FCA914',
          600: '#FCA914',
          700: '#9A5B00',
          800: '#7A4800',
          900: '#5C3600',
        },
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        dark: {
          50:  '#0f172a',
          100: '#0f172a',
          200: '#1e293b',
          300: '#334155',
          400: '#475569',
          500: '#64748b',
          600: '#94a3b8',
          700: '#e2e8f0',
          800: '#ffffff',
          850: '#f8fafc',
          900: '#ffffff',
          950: '#f8fafc',
        },
        accent: {
          cyan:  '#06b6d4',
          green: '#10b981',
          yellow: '#f59e0b',
          red:   '#ef4444',
          blue:  '#3b82f6',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
