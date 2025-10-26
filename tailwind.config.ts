import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  future: {
    disableColorOpacityUtilitiesByDefault: false,
    respectDefaultRingColorOpacity: false,
  },
  corePlugins: {
    preflight: true,
  },
} satisfies Config

