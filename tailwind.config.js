const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        'line-strong': token('line-strong'),
        text: token('text'),
        muted: token('muted'),
        subtle: token('subtle'),
        accent: token('accent'),
        'accent-fg': token('accent-fg'),
        success: token('success'),
        warn: token('warn'),
        danger: token('danger')
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px' },
      fontSize: {
        meta: ['11px', '16px'],
        label: ['12px', '16px'],
        ui: ['13px', '18px'],
        title: ['15px', '22px'],
        page: ['20px', '28px']
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', '-apple-system', 'sans-serif']
      },
      boxShadow: { float: '0 12px 32px rgb(0 0 0 / 0.28)' }
    }
  },
  plugins: []
}

