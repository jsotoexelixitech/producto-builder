/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        navy: {
          DEFAULT: 'hsl(var(--navy))',
          light: 'hsl(var(--navy-light))',
        },
        brand: {
          navy: '#0F1A5A',
          'navy-deep': '#091133',
          'blue-mid': '#2E6DBF',
          red: '#E84F51',
        },
        indigo: {
          50: '#ECEFF8',
          100: '#D2D8EE',
          200: '#A3AEDC',
          300: '#7385C9',
          400: '#455CB1',
          500: '#2A3D8E',
          600: '#162A7F',
          700: '#0F1A5A',
          800: '#0B1444',
          900: '#091133',
        },
        violet: {
          400: '#4A8DD5',
          500: '#2E6DBF',
          600: '#1E51A0',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 12px 32px -12px rgba(9, 17, 51, 0.08)',
        elevated: '0 22px 48px -20px rgba(15, 26, 90, 0.22)',
        brand: '0 10px 26px -6px rgba(15, 26, 90, 0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'spring-in': 'springIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        springIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.96)' },
          '60%': { opacity: '1', transform: 'translateY(-4px) scale(1.015)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
