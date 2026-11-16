/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="oled"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-alt': 'rgb(var(--surface-alt) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        fg: 'rgb(var(--text) / <alpha-value>)',
        'fg-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-contrast': 'rgb(var(--accent-contrast) / <alpha-value>)',
        upvote: 'rgb(var(--upvote) / <alpha-value>)',
        downvote: 'rgb(var(--downvote) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-family)'],
        serif: ['var(--font-family)'],
      },
      fontSize: {
        base: ['var(--font-size)', '1.5'],
      },
      maxWidth: {
        content: 'var(--content-width)',
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
      lineHeight: {
        article: '1.7',
      },
    },
  },
  plugins: [],
};
