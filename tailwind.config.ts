import type { Config } from 'tailwindcss';

/**
 * ProofPay design tokens — Financial Operations SaaS.
 * Canvas #FAFAF8 · Sidebar #F5F5F2 · Ink #191A19 · Graphite #777A77
 * Border #E7E7E2 · Primary forest #176B50 · Amber pending · Vermilion dispute
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF8',
        sidebar: '#F5F5F2',
        porcelain: '#FAFAF8',
        paper: '#FFFFFF',
        ink: '#191A19',
        midnight: '#191A19',
        slate2: '#5F625F',
        graphite: '#777A77',
        faint: '#777A77',
        mineral: { DEFAULT: '#176B50', deep: '#0F4D38', tint: '#EAF3EF' },
        amber2: { DEFAULT: '#946612', tint: '#F7F0DD' },
        vermilion: { DEFAULT: '#B3402A', tint: '#FAECE8' },
        bluegrey: { DEFAULT: '#5B6B7A', tint: '#EDF1F4' },
        line: '#E7E7E2',
        line2: '#D9D9D1',
      },
      fontFamily: {
        sans: ['Inter', '"SF Pro Text"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(25,26,25,.04)',
        lift: '0 4px 16px rgba(25,26,25,.08), 0 1px 3px rgba(25,26,25,.06)',
        menu: '0 8px 30px rgba(25,26,25,.12), 0 2px 6px rgba(25,26,25,.06)',
      },
      transitionDuration: { fast: '140ms', base: '180ms' },
    },
  },
  plugins: [],
};
export default config;
