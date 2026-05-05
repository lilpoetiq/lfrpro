/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        label: ['var(--font-label)', 'var(--font-sans)', 'fantasy', 'cursive'],
      },
      /* Default Tailwind uses line-height: 1 for 5xl+, which clips Syne (display) ascenders/descenders */
      fontSize: {
        '5xl': ['3rem', { lineHeight: '1.15' }],
        '6xl': ['3.75rem', { lineHeight: '1.12' }],
        '7xl': ['4.5rem', { lineHeight: '1.12' }],
        '8xl': ['6rem', { lineHeight: '1.1' }],
        '9xl': ['8rem', { lineHeight: '1.08' }],
      },
      boxShadow: {
        lift: '0 18px 40px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 80px -20px rgba(220,38,38,0.35)',
        'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
      transitionDelay: {
        75: '75ms',
        150: '150ms',
        225: '225ms',
      },
    },
  },
  plugins: [],
}

