/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pitch black / deep charcoal matte surfaces.
        void: '#000000',
        ink: {
          900: '#0A0A0C',
          800: '#0D0D10',
          700: '#121215',
          600: '#16161A',
          500: '#1B1B20',
          400: '#242429',
        },
        // Electric violet accent.
        violet: {
          50: '#F2ECFF',
          200: '#D3BEFF',
          400: '#A87BFF',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6527D6',
          900: '#2A0F63',
        },
        // Metallic gold accent.
        gold: {
          200: '#F7E7AE',
          300: '#EFD27F',
          400: '#E3B84E',
          500: '#D4A017',
          600: '#A87C0C',
        },
        signal: {
          green: '#3ECF8E',
          amber: '#E3B84E',
          red: '#FF5C5C',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow-violet': '0 0 0 1px rgba(139,92,246,0.22), 0 8px 40px -8px rgba(139,92,246,0.45)',
        'glow-gold': '0 0 0 1px rgba(212,160,23,0.25), 0 8px 40px -8px rgba(212,160,23,0.40)',
        'inset-hairline': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
        'panel': '0 24px 60px -24px rgba(0,0,0,0.9)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
        'radial-violet':
          'radial-gradient(60% 60% at 50% 0%, rgba(139,92,246,0.20) 0%, rgba(139,92,246,0) 70%)',
        'radial-gold':
          'radial-gradient(50% 50% at 80% 20%, rgba(212,160,23,0.14) 0%, rgba(212,160,23,0) 70%)',
        'shine':
          'linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.55) 50%, transparent 80%)',
      },
      backgroundSize: {
        'grid-faint': '32px 32px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'bar-dance': {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        'caret': {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'bar-dance': 'bar-dance 0.9s ease-in-out infinite',
        'shimmer': 'shimmer 2.4s linear infinite',
        'marquee': 'marquee 28s linear infinite',
        'scan': 'scan 4.5s linear infinite',
        'caret': 'caret 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
