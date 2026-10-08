import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // `rgb(var(--token) / <alpha-value>)` is what makes `bg-primary/30` work.
        // tokens.css therefore stores channels ("15 118 110") instead of hex, because
        // Tailwind cannot inject alpha into a plain hex variable and silently drops
        // every `token/opacity` class.
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
          soft: 'rgb(var(--color-primary-soft) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        line: 'rgb(var(--color-border) / <alpha-value>)',
        highlight: 'rgb(var(--color-highlight) / <alpha-value>)',
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          text: 'rgb(var(--color-success-text) / <alpha-value>)',
          soft: 'rgb(var(--color-success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          text: 'rgb(var(--color-warning-text) / <alpha-value>)',
          soft: 'rgb(var(--color-warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          text: 'rgb(var(--color-danger-text) / <alpha-value>)',
          soft: 'rgb(var(--color-danger-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info) / <alpha-value>)',
          text: 'rgb(var(--color-info-text) / <alpha-value>)',
          soft: 'rgb(var(--color-info-soft) / <alpha-value>)',
        },
        neutral: {
          DEFAULT: 'rgb(var(--color-neutral) / <alpha-value>)',
          text: 'rgb(var(--color-neutral-text) / <alpha-value>)',
          soft: 'rgb(var(--color-neutral-soft) / <alpha-value>)',
        },
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        hero: 'var(--radius-hero)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      maxWidth: {
        content: '1200px',
        narrow: '1040px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'zoom-in': 'zoom-in 160ms ease-out',
        skeleton: 'skeleton-pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;