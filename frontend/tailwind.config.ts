import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--surface)',
        panel2: 'var(--surface2)',
        raise: 'var(--raise)',
        edge: 'var(--border)',
        edge2: 'var(--border2)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        'accent-hi': 'var(--accent-hi)',
        'accent-fg': 'var(--accent-fg)',
        'accent-soft': 'var(--accent-soft)',
        'dot-a': 'var(--dot-a)',
        'dot-b': 'var(--dot-b)',
        'dot-c': 'var(--dot-c)',
        'dot-d': 'var(--dot-d)',
      },
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
