/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           'var(--bg)',
        surface:      'var(--surface)',
        'surface-2':  'var(--surface-2)',
        line:         'var(--line)',
        ink:          'var(--ink)',
        'ink-2':      'var(--ink-2)',
        muted:        'var(--muted)',
        accent:       'var(--accent)',
        'accent-hover':'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        focus:        'var(--focus)',
        success:      'var(--success)',
        warning:      'var(--warning)',
        danger:       'var(--danger)',
        info:         'var(--info)',
      },
      fontFamily: {
        sans:  ['"IBM Plex Sans"', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono:  ['"IBM Plex Mono"', '"JetBrains Mono"', 'Menlo', 'monospace'],
        display: ['"IBM Plex Sans"', '"Space Grotesk"', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['12px', '16px'],
        xs:    ['14px', '20px'],
        sm:    ['16px', '24px'],
        md:    ['20px', '28px'],
        lg:    ['28px', '36px'],
        xl:    ['36px', '44px'],
      },
      borderRadius: {
        input: '8px',
        card:  '12px',
        pill:  '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06)',
      },
      maxWidth: {
        content: '640px',
        page:    '960px',
      },
    },
  },
  plugins: [],
}
