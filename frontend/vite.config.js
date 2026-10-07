import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode browser` produces the browser edition: the whole app,
// API included (src/browser/), as static files that work from any path —
// a Hugging Face static Space, GitHub Pages, or a local folder.
export default defineConfig(({ mode }) => {
  const browserEdition = mode === 'browser'
  return {
    base: browserEdition ? './' : '/',
    plugins: [react()],
    define: {
      __BROWSER_EDITION__: JSON.stringify(browserEdition),
    },
    build: {
      outDir: browserEdition ? 'dist-browser' : 'dist',
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8004',
          changeOrigin: true,
        },
      },
    },
  }
})
