/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px -8px rgb(0 0 0 / 0.08)',
        pop: '0 8px 40px -12px rgb(0 0 0 / 0.25)',
        glow: '0 0 0 1px rgb(99 102 241 / 0.25), 0 8px 40px -8px rgb(99 102 241 / 0.35)',
      },
      keyframes: {
        floatUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        pulse2: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
      animation: {
        'in': 'floatUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scaleIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 2.2s linear infinite',
        'soft-pulse': 'pulse2 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
