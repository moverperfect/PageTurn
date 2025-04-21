/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'glow-primary': 'var(--glow-primary)',
        'glow-secondary': 'var(--glow-secondary)',
        indigo: {
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
          950: '#1e1b4b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': {
            boxShadow:
              '0 0 5px rgba(99, 102, 241, 0.2), 0 0 20px rgba(99, 102, 241, 0.1)',
          },
          '100%': {
            boxShadow:
              '0 0 10px rgba(99, 102, 241, 0.3), 0 0 30px rgba(99, 102, 241, 0.2)',
          },
        },
      },
      boxShadow: {
        'glow-sm':
          '0 0 5px rgba(99, 102, 241, 0.2), 0 0 20px rgba(99, 102, 241, 0.1)',
        'glow-md':
          '0 0 15px rgba(99, 102, 241, 0.3), 0 0 45px rgba(99, 102, 241, 0.2)',
        'glow-lg':
          '0 0 25px rgba(99, 102, 241, 0.4), 0 0 70px rgba(99, 102, 241, 0.3)',
        'glow-xl':
          '0 0 40px rgba(99, 102, 241, 0.5), 0 0 100px rgba(99, 102, 241, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
