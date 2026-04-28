/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        window: 'var(--bg-window)',
        main: 'var(--bg-main)',
        header: 'var(--bg-header)',
        primary: 'var(--primary)',
        'primary-text': 'var(--text-on-primary)',
        secondary: 'var(--secondary)',
        'secondary-text': 'var(--text-on-secondary)',
        accent: 'var(--accent)',
        'accent-text': 'var(--text-on-accent)',
        border: 'var(--border)',
        'border-text': 'var(--text-on-border)',
        'header-text': 'var(--text-on-header)',
        'main-text': 'var(--text-main)',
      }
    },
  },
  plugins: [],
}
