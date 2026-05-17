/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--bb-color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--bb-color-surface) / <alpha-value>)',
        raised: 'rgb(var(--bb-color-surface-raised) / <alpha-value>)',
        muted: 'rgb(var(--bb-color-surface-muted) / <alpha-value>)',
        border: 'rgb(var(--bb-color-border) / <alpha-value>)',
        text: 'rgb(var(--bb-color-text) / <alpha-value>)',
        subdued: 'rgb(var(--bb-color-text-subdued) / <alpha-value>)',
        action: 'rgb(var(--bb-color-action) / <alpha-value>)',
        'action-strong': 'rgb(var(--bb-color-action-strong) / <alpha-value>)',
        danger: 'rgb(var(--bb-color-danger) / <alpha-value>)',
        success: 'rgb(var(--bb-color-success) / <alpha-value>)',
        warning: 'rgb(var(--bb-color-warning) / <alpha-value>)',
      },
      borderRadius: {
        sm: 'var(--bb-radius-sm)',
        md: 'var(--bb-radius-md)',
        lg: 'var(--bb-radius-lg)',
        xl: 'var(--bb-radius-xl)',
      },
      boxShadow: {
        soft: 'var(--bb-shadow-soft)',
        raised: 'var(--bb-shadow-raised)',
      },
      fontFamily: {
        sans: 'var(--bb-font-sans)',
      },
    },
  },
  plugins: [],
}
