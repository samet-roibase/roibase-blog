import type { Config } from 'tailwindcss'

// Tailwind theme mirrors the Roibase main site's design system so the blog
// feels like a first-party extension — same primary slate, signature cyan,
// dark surface tones, and Inter / JetBrains Mono typography ramp.
export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
    './content/**/*.md'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#4b6584',
        pCyan: '#22d3ee',
        pPurple: '#a855f7',
        pGreen: '#26de81',
        pOrange: '#fd9644',
        pRed: '#fc5c65',
        dark: '#0b1120',
        surface: '#1e293b'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      typography: ({ theme }: { theme: (path: string) => string }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-links': theme('colors.pCyan'),
            '--tw-prose-headings': theme('colors.dark'),
            maxWidth: '72ch'
          }
        },
        invert: {
          css: {
            '--tw-prose-links': theme('colors.pCyan'),
            '--tw-prose-headings': theme('colors.white')
          }
        }
      })
    }
  },
  plugins: []
}
